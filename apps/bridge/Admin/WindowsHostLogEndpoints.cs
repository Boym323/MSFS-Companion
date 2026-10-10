namespace MsfsCompanion.Bridge.Admin;

/// <summary>
/// Bounded, sanitized Windows-host log for an already trusted LAN session.
/// Exposed only inside the installed Windows host; no paths or filenames
/// are accepted from HTTP. No endpoint exists in standalone dev mode.
/// </summary>
internal static class WindowsHostLogEndpoints
{
    public static void MapWindowsHostLog(this WebApplication app)
    {
        if (string.IsNullOrWhiteSpace(
            Environment.GetEnvironmentVariable("MSFS_COMPANION_CONTROL_DIR")))
            return;

        app.MapGet("/api/health/windows-host-log", (HttpContext context, int? lines) =>
        {
            context.Response.Headers.CacheControl = "no-store, max-age=0";
            context.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.Ok(WindowsHostLogReader.Read(lines ?? 150));
        });
    }
}
