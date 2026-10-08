using System.Net;
using Makaretu.Dns;

namespace MsfsCompanion.WindowsHost;

/// <summary>
/// Lokální Bonjour/mDNS inzerce uživatelsky zvoleného hostitele. Není potřeba registrace na routeru
/// ani nový server v LAN. Když multicast nefunguje, zůstává funkční IP adresa.
/// </summary>
internal sealed class CompanionMdnsPublisher : IDisposable
{
    public const string DefaultHostName = "kokpit.local";
    public const string ServiceType = "_http._tcp";
    public const int Port = 8765;
    public string HostName { get; private set; } = DefaultHostName;
    public string DashboardUrl => $"http://{HostName}:{Port}/admin";

    private ServiceDiscovery? _discovery;
    private ServiceProfile? _profile;
    private IPAddress? _advertisedAddress;
    private string? _advertisedName;

    public bool Active => _discovery is not null;
    public string Status { get; private set; } = "mDNS čeká na privátní LAN.";

    public void Refresh(bool enabled, string shortName, LanAccess.LanAddress? lan, bool bridgeRunning)
    {
        if (!enabled || lan is null || !bridgeRunning)
        {
            Stop();
            Status = !enabled ? "mDNS vypnuté v nastavení."
                : lan is null ? "Není dostupná privátní LAN."
                : "Bridge není spuštěný.";
            return;
        }

        if (!HostSettings.TryNormalizeMdnsName(shortName, out var label, out _))
        {
            Stop();
            Status = "Neplatný mDNS název.";
            return;
        }
        var hostName = label + ".local";
        if (Active && Equals(_advertisedAddress, lan.Address) && _advertisedName == hostName)
            return;

        Stop();

        try
        {
            // Explicitní IPv4 adresa je jediná publikovaná A hodnota:
            // nevystavujeme VPN, externí ani link-local adresy.
            var profile = BuildProfile(lan.Address, label);

            var discovery = new ServiceDiscovery();
            try
            {
                discovery.Advertise(profile);
                discovery.Announce(profile);
                _discovery = discovery;
                _profile = profile;
                _advertisedAddress = lan.Address;
                _advertisedName = hostName;
                HostName = hostName;
                Status = "mDNS aktivní: " + DashboardUrl;
                EventLogFile.Write($"mDNS inzeruje {HostName} => {lan.Address}, TCP {Port}");
            }
            catch
            {
                discovery.Dispose();
                throw;
            }
        }
        catch (Exception ex)
        {
            Stop();
            Status = "mDNS nedostupné (připojte se přes IP).";
            EventLogFile.Write("mDNS start failed: " + ex);
        }
    }

    internal static ServiceProfile BuildProfile(IPAddress lanIp, string label)
    {
        if (!HostSettings.TryNormalizeMdnsName(label, out var normalized, out _))
            throw new ArgumentException("Neplatný mDNS název.", nameof(label));
        var hostName = normalized + ".local";
        var profile = new ServiceProfile("MSFS-Companion", ServiceType, Port, [lanIp])
        {
            HostName = hostName
        };
        foreach (var record in profile.Resources)
        {
            if (record is SRVRecord srv)
                srv.Target = hostName;
            if (record is AddressRecord)
                record.Name = hostName;
        }
        profile.AddProperty("path", "/admin");
        profile.AddProperty("product", "MSFS Companion");
        profile.AddProperty("version", "1");
        return profile;
    }

    // Deterministický test nezávislý na síťovém multicastu.
    internal static bool SelfTest()
    {
        var ip = IPAddress.Parse("192.168.1.25");
        foreach (var label in new[] { HostSettings.DefaultMdnsName, "simdeck", "letadlo-2" })
        {
            var hostName = label + ".local";
            var profile = BuildProfile(ip, label);
            if (profile.HostName.ToString() != hostName ||
                !profile.Resources.OfType<SRVRecord>().Any(r =>
                    r.Target.ToString() == hostName && r.Port == Port) ||
                !profile.Resources.OfType<ARecord>().Any(r =>
                    r.Name.ToString() == hostName && Equals(r.Address, ip)))
                return false;
        }
        return HostSettings.TryNormalizeMdnsName(" SimDeck ", out var normalized, out _)
            && normalized == "simdeck"
            && !HostSettings.TryNormalizeMdnsName("foo.local", out _, out _)
            && !HostSettings.TryNormalizeMdnsName("-bad", out _, out _)
            && !HostSettings.TryNormalizeMdnsName("bad.name", out _, out _)
            && !HostSettings.TryNormalizeMdnsName(new string('x', 64), out _, out _);
    }

    public void Stop()
    {
        var discovery = _discovery;
        var profile = _profile;
        _discovery = null;
        _profile = null;
        _advertisedAddress = null;
        _advertisedName = null;
        if (discovery is null) return;

        try
        {
            if (profile is not null) discovery.Unadvertise(profile);
        }
        catch (Exception ex)
        {
            EventLogFile.Write("mDNS goodbye failed: " + ex.Message);
        }
        finally
        {
            discovery.Dispose();
        }
    }

    public void Dispose() => Stop();
}
