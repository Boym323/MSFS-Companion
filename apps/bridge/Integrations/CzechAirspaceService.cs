using System.Text;

namespace MsfsCompanion.Bridge.Integrations;

/// <summary>
/// C35 V2: bezpečné read-only načtení pevného veřejného OpenAir souboru
/// Aeroklubu ČR, pouze na přímou žádost pilota. Není to živá databáze NOTAM.
/// </summary>
public sealed class CzechAirspaceService : IDisposable
{
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
    private DateTimeOffset? _fetchedUtc;
    private DateTimeOffset _attemptUtc = DateTimeOffset.MinValue;
    private string? _lastError;

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
                    using var response = await _http.GetAsync(Source,
                        HttpCompletionOption.ResponseHeadersRead, cancellation);
                    if (!response.IsSuccessStatusCode)
                        throw new HttpRequestException("OpenAir HTTP " + (int)response.StatusCode);
                    if (response.Content.Headers.ContentLength is > MaxBytes)
                        throw new InvalidDataException("OpenAir maximum size exceeded");

                    await using var stream = await response.Content.ReadAsStreamAsync(cancellation);
                    using var memory = new MemoryStream();
                    var buffer = new byte[16_384];
                    int length;
                    while ((length = await stream.ReadAsync(buffer.AsMemory(), cancellation)) > 0)
                    {
                        if (memory.Length + length > MaxBytes)
                            throw new InvalidDataException("OpenAir maximum size exceeded");
                        memory.Write(buffer, 0, length);
                    }
                    var text = Encoding.UTF8.GetString(memory.ToArray());
                    if (!text.Contains("\nAC ", StringComparison.Ordinal) &&
                        !text.StartsWith("AC ", StringComparison.Ordinal))
                        throw new InvalidDataException("OpenAir source missing airspace definitions");
                    _data = text;
                    _fetchedUtc = DateTimeOffset.UtcNow;
                    _lastError = null;
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
                effectiveDate = EffectiveDate,
                source = Source.ToString(),
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
