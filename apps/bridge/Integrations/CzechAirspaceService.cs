using System.Text;
using System.Text.RegularExpressions;
using System.Globalization;

namespace MsfsCompanion.Bridge.Integrations;

/// <summary>
/// C35 V2: bezpečné read-only načtení pevného veřejného OpenAir souboru
/// Aeroklubu ČR, pouze na přímou žádost pilota. Není to živá databáze NOTAM.
/// </summary>
public sealed class CzechAirspaceService : IDisposable
{
    private static readonly Uri Index = new("https://airspace.aeroklub.cz/docs/public/");
    private static readonly Uri Source = new(
        "https://airspace.aeroklub.cz/docs/public/CZ_all_26-04-01.txt");
    public const string EffectiveDate = "2026-04-01";
    private const int MaxBytes = 2_000_000;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly HttpClient _http = new(new HttpClientHandler
    {
        AllowAutoRedirect = false
    })
    {
        Timeout = TimeSpan.FromSeconds(18)
    };
    private string? _data;
    private Uri _selectedSource=Source;
    private string _selectedEffectiveDate=EffectiveDate;
    private DateTimeOffset? _fetchedUtc;
    private DateTimeOffset _attemptUtc = DateTimeOffset.MinValue;
    private string? _lastError;

    // Source discovery only extracts a constrained filename from the fixed,
    // official HTTPS directory. It never follows publisher-provided arbitrary URLs.
    public static (string FileName,string EffectiveDate)? FindCurrentRelease(
        string html,DateTimeOffset now)
    {
        if(html.Length>150_000)return null;
        var candidates=new List<(string FileName,DateTime Date)>();
        foreach(Match match in Regex.Matches(html,@"CZ_all_(\d{2})-(\d{2})-(\d{2})\.txt",
            RegexOptions.CultureInvariant | RegexOptions.IgnoreCase,
            TimeSpan.FromMilliseconds(200)))
        {
            var candidate="20"+match.Groups[1].Value+"-"+
                match.Groups[2].Value+"-"+match.Groups[3].Value;
            if(!DateTime.TryParseExact(candidate,"yyyy-MM-dd",
                CultureInfo.InvariantCulture,DateTimeStyles.None,out var date)||
                date.Year<2025||date>DateTime.UtcNow.AddYears(2)||
                date.Date>now.UtcDateTime.Date)continue;
            candidates.Add(("CZ_all_"+match.Groups[1].Value+"-"+
                match.Groups[2].Value+"-"+match.Groups[3].Value+".txt",date));
        }
        if(candidates.Count==0)return null;
        var best=candidates.OrderByDescending(x=>x.Date).First();
        return (best.FileName,best.Date.ToString("yyyy-MM-dd",CultureInfo.InvariantCulture));
    }

    private async Task<string> ReadLimitedAsync(Uri uri,int maxBytes,CancellationToken cancellation)
    {
        using var response=await _http.GetAsync(uri,HttpCompletionOption.ResponseHeadersRead,cancellation);
        if(!response.IsSuccessStatusCode)
            throw new HttpRequestException("OpenAir HTTP "+(int)response.StatusCode);
        if(response.Content.Headers.ContentLength is { } length&&length>maxBytes)
            throw new InvalidDataException("OpenAir maximum size exceeded");
        await using var stream=await response.Content.ReadAsStreamAsync(cancellation);
        using var memory=new MemoryStream();
        var buffer=new byte[16_384];
        int count;
        while((count=await stream.ReadAsync(buffer.AsMemory(),cancellation))>0)
        {
            if(memory.Length+count>maxBytes)
                throw new InvalidDataException("OpenAir maximum size exceeded");
            memory.Write(buffer,0,count);
        }
        return Encoding.UTF8.GetString(memory.ToArray());
    }

    public async Task<object> GetAsync(CancellationToken cancellation)
    {
        await _gate.WaitAsync(cancellation);
        try
        {
            var now = DateTimeOffset.UtcNow;
            if ((!_fetchedUtc.HasValue || now - _fetchedUtc >= TimeSpan.FromHours(24)) &&
                now - _attemptUtc >= TimeSpan.FromMinutes(15))
            {
                _attemptUtc = now;
                try
                {
                    Uri target=Source;
                    string effective=EffectiveDate;
                    try
                    {
                        var listing=await ReadLimitedAsync(Index,150_000,cancellation);
                        var latest=FindCurrentRelease(listing,now);
                        if(latest is { } published)
                        {
                            target=new Uri(Index,published.FileName);
                            effective=published.EffectiveDate;
                        }
                    }
                    catch(Exception ex) when(!cancellation.IsCancellationRequested)
                    {
                        // Retain known fixed source only when catalog is unavailable.
                        _lastError="Katalog Aeroklubu nelze ověřit ("+ex.GetType().Name+").";
                    }
                    var text=await ReadLimitedAsync(target,MaxBytes,cancellation);
                    if (!text.Contains("\nAC ", StringComparison.Ordinal) &&
                        !text.StartsWith("AC ", StringComparison.Ordinal))
                        throw new InvalidDataException("OpenAir source missing airspace definitions");
                    _data = text;
                    _selectedSource=target;
                    _selectedEffectiveDate=effective;
                    _fetchedUtc = DateTimeOffset.UtcNow;
                    // If index verification failed, expose the warning even if
                    // the known historical file was downloaded successfully.
                    if(_lastError is not null && !target.Equals(Source))_lastError=null;
                }
                catch (Exception ex) when (!cancellation.IsCancellationRequested)
                {
                    _lastError = "Veřejný zdroj není dostupný (" + ex.GetType().Name + ").";
                }
            }

            var stale = _fetchedUtc is null || DateTimeOffset.UtcNow - _fetchedUtc >= TimeSpan.FromHours(24)
                || _lastError is not null;
            return new
            {
                available = _data is not null,
                stale,
                updatedAtUtc = _fetchedUtc,
                effectiveDate = _selectedEffectiveDate,
                source = _selectedSource.ToString(),
                publisher = "Aeroklub České republiky / Jan Zahradka",
                data = _data,
                error = _lastError
            };
        }
        finally
        {
            _gate.Release();
        }
    }

    public void Dispose()
    {
        _http.Dispose();
        _gate.Dispose();
    }
}
