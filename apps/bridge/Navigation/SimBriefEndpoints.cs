using System.Text.RegularExpressions;

namespace MsfsCompanion.Bridge.Navigation;

/// <summary>Načtení posledního OFP pouze na výslovný požadavek uživatele.</summary>
public static class SimBriefEndpoints
{
    private static readonly HttpClient Client = new()
    {
        BaseAddress = new Uri("https://www.simbrief.com/"),
        Timeout = TimeSpan.FromSeconds(10)
    };

    public static void MapSimBrief(this WebApplication app)
    {
        app.MapGet("/api/flightplans/simbrief/{pilotId}", async (string pilotId, CancellationToken ct) =>
        {
            if (pilotId.Length is < 1 or > 7 || !pilotId.All(char.IsAsciiDigit))
                return Results.BadRequest(new { error = "SimBrief Pilot ID musí mít 1–7 číslic." });
            try
            {
                using var response = await Client.GetAsync(
                    "api/xml.fetcher.php?userid=" + pilotId, HttpCompletionOption.ResponseHeadersRead, ct);
                if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength is > 4_000_000)
                    return Results.Problem("SimBrief OFP není dostupný.", statusCode: 502);
                using var limited = new MemoryStream();
                await using var input = await response.Content.ReadAsStreamAsync(ct);
                var buffer = new byte[8192];
                int n;
                while ((n = await input.ReadAsync(buffer.AsMemory(), ct)) > 0)
                {
                    if (limited.Length + n > 4_000_000)
                        return Results.Problem("SimBrief odpověď je příliš velká.", statusCode: 502);
                    await limited.WriteAsync(buffer.AsMemory(0, n), ct);
                }
                var xml = System.Text.Encoding.UTF8.GetString(limited.ToArray());
                if (!xml.TrimStart().StartsWith("<?xml", StringComparison.OrdinalIgnoreCase)
                    && !xml.TrimStart().StartsWith("<OFP", StringComparison.OrdinalIgnoreCase))
                    return Results.Problem("SimBrief nevrátil dokument OFP.", statusCode: 502);
                return Results.Text(xml, "application/xml");
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException)
            {
                return Results.Problem("SimBrief se nepodařilo načíst.", statusCode: 502);
            }
        });
    }
}
