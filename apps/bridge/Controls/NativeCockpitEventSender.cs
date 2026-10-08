using System.Runtime.InteropServices;

namespace MsfsCompanion.Bridge.Controls;

/// <summary>
/// Nezávislý, uzamčený SimConnect handle pouze pro ovládací Key Events.
/// Nedotýká se fungujícího odběru telemetrie ani jeho frekvence.
/// Vyžaduje Windows a živý MSFS; při selhání zahodí spojení.
/// </summary>
public sealed class NativeCockpitEventSender : IDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly Dictionary<string, uint> _mapped = new(StringComparer.Ordinal);
    private IntPtr _handle;
    private uint _nextEvent = 1;

    public async Task SendAsync(MappedCockpitEvent command, CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("Ovládání je možné pouze na Windows.");

        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_handle == IntPtr.Zero)
            {
                Check(Native.SimConnect_Open(out _handle, "MSFS Companion Cockpit Controls",
                    IntPtr.Zero, 0, IntPtr.Zero, 0));
                _mapped.Clear();
                _nextEvent = 1;
            }

            if (!_mapped.TryGetValue(command.Name, out var eventId))
            {
                eventId = _nextEvent++;
                Check(Native.SimConnect_MapClientEventToSimEvent(_handle, eventId, command.Name));
                Check(Native.SimConnect_AddClientEventToNotificationGroup(_handle, 0, eventId, false));
                _mapped.Add(command.Name, eventId);
            }

            // Odeslání neznamená, že jej každé letadlo respektuje.
            Check(Native.SimConnect_TransmitClientEvent(_handle, 0, eventId, command.Data, 0, 0));
        }
        catch
        {
            CloseConnection();
            throw;
        }
        finally
        {
            _gate.Release();
        }
    }

    private static void Check(int result)
    {
        if (result < 0) Marshal.ThrowExceptionForHR(result);
    }

    private void CloseConnection()
    {
        if (_handle != IntPtr.Zero)
        {
            Native.SimConnect_Close(_handle);
            _handle = IntPtr.Zero;
        }
        _mapped.Clear();
    }

    public void Dispose()
    {
        _gate.Wait();
        try { CloseConnection(); }
        finally { _gate.Release(); }
    }

    private static class Native
    {
        [DllImport("SimConnect.dll", CharSet = CharSet.Ansi)]
        public static extern int SimConnect_Open(out IntPtr handle, string name, IntPtr hwnd,
            uint userEvent, IntPtr eventHandle, uint configIndex);

        [DllImport("SimConnect.dll", CharSet = CharSet.Ansi)]
        public static extern int SimConnect_MapClientEventToSimEvent(IntPtr handle, uint eventId, string eventName);

        [DllImport("SimConnect.dll")]
        public static extern int SimConnect_AddClientEventToNotificationGroup(IntPtr handle, uint groupId, uint eventId,
            [MarshalAs(UnmanagedType.Bool)] bool maskable);

        [DllImport("SimConnect.dll")]
        public static extern int SimConnect_TransmitClientEvent(IntPtr handle, uint objectId, uint eventId,
            uint data, uint groupId, uint flags);

        [DllImport("SimConnect.dll")]
        public static extern int SimConnect_Close(IntPtr handle);
    }
}
