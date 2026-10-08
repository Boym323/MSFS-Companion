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

    public static LanAddress? Find()
    {
        try
        {
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

                    return new LanAddress(item.Address, item.IPv4Mask);
                }
            }
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
