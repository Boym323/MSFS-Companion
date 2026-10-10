using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace MsfsCompanion.WindowsHost;

/// <summary>
/// Vybere běžnou aktivní IPv4 adresu domácí sítě. Nepoužíváme wildcard
/// naslouchání 0.0.0.0, aby web nebyl současně otevřen na VPN nebo WAN.
/// </summary>
internal static class LanAccess
{
    internal sealed record LanAddress(IPAddress Address, IPAddress Mask)
    {
        public string DashboardUrl => $"http://{Address}:8765/admin";
    }

    // Prefer the already-bound interface even if Windows enumeration order
    // changes. Otherwise the periodic host health tick can kill a live bridge.
    internal static LanAddress? Select(IEnumerable<LanAddress> candidates, string? preferred)
    {
        var addresses = candidates.ToList();
        return addresses.FirstOrDefault(x =>
                   string.Equals(x.Address.ToString(), preferred, StringComparison.Ordinal))
               ?? addresses.FirstOrDefault();
    }

    internal static bool SelfTest()
    {
        var a = new LanAddress(IPAddress.Parse("192.168.1.7"), IPAddress.Parse("255.255.255.0"));
        var b = new LanAddress(IPAddress.Parse("10.0.1.9"), IPAddress.Parse("255.255.255.0"));
        return Equals(Select([a,b], b.Address.ToString()), b)
            && Equals(Select([b,a], b.Address.ToString()), b)
            && Equals(Select([a,b], "192.168.9.9"), a)
            && Select([], "192.168.1.7") is null;
    }

    public static LanAddress? Find(string? preferred = null)
    {
        try
        {
            var candidates = new List<LanAddress>();
            foreach (var adapter in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (adapter.OperationalStatus != OperationalStatus.Up
                    || adapter.NetworkInterfaceType is not (NetworkInterfaceType.Ethernet or NetworkInterfaceType.Wireless80211))
                    continue;

                foreach (var item in adapter.GetIPProperties().UnicastAddresses)
                {
                    if (item.Address.AddressFamily != AddressFamily.InterNetwork
                        || item.IPv4Mask is null || !IsPrivate(item.Address))
                        continue;

                    candidates.Add(new LanAddress(item.Address, item.IPv4Mask));
                }
            }
            return Select(candidates, preferred);
        }
        catch (NetworkInformationException ex)
        {
            EventLogFile.Write($"Zjištění LAN adresy selhalo: {ex.Message}");
        }

        return null;
    }

    private static bool IsPrivate(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return bytes[0] == 10
            || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
            || (bytes[0] == 192 && bytes[1] == 168);
    }
}
