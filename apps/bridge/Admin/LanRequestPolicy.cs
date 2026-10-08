using System.Net;
using System.Net.Sockets;

namespace MsfsCompanion.Bridge.Admin;

/// <summary>
/// Omezení na loopback nebo stejnou privátní podsíť přímo připojeného
/// adaptéru. Zabrání DNS rebinding přes cizí Host hlavičku a
/// cross-site POST vyžaduje správný Origin a vlastní hlavičku.
/// Nejde o autentizaci uživatele: kdokoli ve stejné podsíti má přístup.
/// </summary>
internal static class LanRequestPolicy
{
    private static readonly string? LanIp = Environment.GetEnvironmentVariable("MSFS_COMPANION_LAN_ADDRESS");
    private static readonly string? LanMask = Environment.GetEnvironmentVariable("MSFS_COMPANION_LAN_NETMASK");
    private static readonly string? MdnsHost = ValidateMdnsHost(
        Environment.GetEnvironmentVariable("MSFS_COMPANION_MDNS_NAME"));

    private static string? ValidateMdnsHost(string? configured)
    {
        if (configured is null) return null;
        var hostname = configured.ToLowerInvariant();
        if (!hostname.EndsWith(".local", StringComparison.Ordinal)) return null;
        var label = hostname[..^6];
        if (label.Length is < 1 or > 63 ||
            label[0] == '-' || label[^1] == '-' ||
            label.Any(c => !(c is >= 'a' and <= 'z' or >= '0' and <= '9' or '-')))
            return null;
        return hostname;
    }

    public static bool Allows(HttpContext context)
    {
        var remote = context.Connection.RemoteIpAddress;
        if (remote is null)
            return false;

        if (remote.IsIPv4MappedToIPv6)
            remote = remote.MapToIPv4();

        var host = context.Request.Host.Host;
        if (IPAddress.IsLoopback(remote))
            return host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                || host.Equals("127.0.0.1", StringComparison.Ordinal)
                || host.Equals("::1", StringComparison.Ordinal)
                 || MdnsHost is not null && host.Equals(MdnsHost, StringComparison.OrdinalIgnoreCase);

        if (remote.AddressFamily != AddressFamily.InterNetwork
            || !IPAddress.TryParse(LanIp, out var address)
            || !IPAddress.TryParse(LanMask, out var mask)
            || mask.AddressFamily != AddressFamily.InterNetwork)
            return false;

        var allowedIpHost = host.Equals(address.ToString(), StringComparison.Ordinal);
        var allowedMdnsHost = MdnsHost is not null
            && host.Equals(MdnsHost, StringComparison.OrdinalIgnoreCase);
        if (!allowedIpHost && !allowedMdnsHost)
            return false;

        var ipBytes = remote.GetAddressBytes();
        var addressBytes = address.GetAddressBytes();
        var maskBytes = mask.GetAddressBytes();
        for (var i = 0; i < 4; i++)
        {
            if ((ipBytes[i] & maskBytes[i]) != (addressBytes[i] & maskBytes[i]))
                return false;
        }

        return true;
    }

    public static bool AllowsUpdateRequest(HttpContext context)
    {
        if (!Allows(context))
            return false;

        // Bez CORS, CSRF tokenu v URL a cookies. Vlastní HTTP hlavičku
        // obyčejný HTML formulář z cizího webu nedokáže poslat.
        if (!context.Request.Headers.TryGetValue("X-MSFS-Companion-Action", out var action)
            || action.Count != 1 || action[0] != "check-update")
            return false;

        if (!context.Request.Headers.TryGetValue("Origin", out var origin)
            || origin.Count != 1
            || !Uri.TryCreate(origin[0], UriKind.Absolute, out var originUri))
            return false;

        var host = context.Request.Host;
        return originUri.Scheme.Equals(context.Request.Scheme, StringComparison.OrdinalIgnoreCase)
            && originUri.Host.Equals(host.Host, StringComparison.OrdinalIgnoreCase)
            && originUri.Port == (host.Port ?? (context.Request.IsHttps ? 443 : 80))
            && originUri.AbsolutePath == "/"
            && originUri.Query.Length == 0
            && originUri.Fragment.Length == 0;
    }
}
