using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>
/// Explicit, bounded SimConnect ClientData channel to Kokpit's own optional
/// MSFS 2020 in-sim WASM module. Never executes arbitrary gauge scripts from
/// the HTTP API. Uses an independent SimConnect handle (not the 20Hz PFD).
/// </summary>
public sealed class A320WasmEventSender : IDisposable
{
    private readonly SemaphoreSlim _serial = new(1,1);
    private DateTimeOffset _lastConfirmedUtc;
    private string? _lastFailure;
    private uint _lastProtocolStatus;

    public bool RecentlyAvailable =>
        DateTimeOffset.UtcNow - _lastConfirmedUtc < TimeSpan.FromSeconds(90);
    public string? LastFailure => _lastFailure;
    public uint LastProtocolStatus => _lastProtocolStatus;

    public async Task<bool> ProbeAsync(CancellationToken cancellationToken)
    {
        try { return await SendAsync(0,cancellationToken)==1; }
        catch(Exception ex) when (ex is IOException or COMException
            or DllNotFoundException or EntryPointNotFoundException
            or PlatformNotSupportedException)
        {
            // Stable diagnostic codes, not an arbitrary native exception string.
            _lastFailure=ex is IOException && (
                ex.Message.Contains("timeout",StringComparison.OrdinalIgnoreCase) ||
                ex.Message.Contains("acknowledge",StringComparison.OrdinalIgnoreCase))
                ? "ack_timeout" : ex.GetType().Name;
            return false;
        }
    }

    /// <returns>1 = module accepted opcode, 2 = calculator code rejected,
    /// 3 = unknown opcode. The physical cockpit result remains unverified.</returns>
    public async Task<uint> SendAsync(uint operation,CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("WASM bridge requires MSFS 2020 on Windows.");
        if (operation>6)
            throw new ArgumentOutOfRangeException(nameof(operation));
        await _serial.WaitAsync(cancellationToken);
        IntPtr handle=IntPtr.Zero;
        try
        {
            Check(Native.Open(out handle,"Kokpit A320 H-Event Client",
                IntPtr.Zero,0,IntPtr.Zero,0));
            Check(Native.MapClientDataNameToID(handle,A320WasmProtocol.CommandChannel,1));
            Check(Native.MapClientDataNameToID(handle,A320WasmProtocol.ResponseChannel,2));
            Check(Native.AddToClientDataDefinition(handle,11,0,16,0,uint.MaxValue));
            Check(Native.AddToClientDataDefinition(handle,12,0,16,0,uint.MaxValue));

            // 2 = ON_SET. Register the ack subscriber before sending commands.
            Check(Native.RequestClientData(handle,2,21,12,2,0,0,0,0));
            var sequence=(uint)RandomNumberGenerator.GetInt32(1,int.MaxValue);
            var request=new A320WasmProtocol.Command {
                Magic=A320WasmProtocol.Magic,Version=A320WasmProtocol.Version,
                Sequence=sequence,Operation=operation
            };
            Check(Native.SetClientData(handle,1,11,0,0,16,ref request));

            using var timeout=CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromMilliseconds(1400));
            while (!timeout.IsCancellationRequested)
            {
                // Unlike the continuous live telemetry connection, this
                // short-lived private client polls only for its own ack.
                var result=Native.GetNextDispatch(handle,out var data,out var length);
                if (result>=0 && data!=IntPtr.Zero && length>=56 &&
                    Marshal.ReadInt32(data,8)==16 && // SIMCONNECT_RECV_ID_CLIENT_DATA
                    Marshal.ReadInt32(data,12)==21) // RequestId
                {
                    var reply=Marshal.PtrToStructure<A320WasmProtocol.Reply>(
                        IntPtr.Add(data,40));
                    if (!A320WasmProtocol.Valid(reply,sequence))continue;
                    _lastProtocolStatus=reply.Status;
                    if (reply.Status==1)
                    {
                        _lastConfirmedUtc=DateTimeOffset.UtcNow;
                        _lastFailure=null;
                    }
                    return reply.Status;
                }
                await Task.Delay(35,timeout.Token);
            }
            throw new IOException("Kokpit A320 WASM module did not acknowledge the command.");
        }
        catch(OperationCanceledException) when(!cancellationToken.IsCancellationRequested)
        {
            throw new IOException("Kokpit A320 WASM module not detected (ack timeout).");
        }
        catch
        {
            _lastConfirmedUtc=default;
            throw;
        }
        finally
        {
            if (handle!=IntPtr.Zero)
                Native.Close(handle);
            _serial.Release();
        }
    }

    private static void Check(int hr)
    {
        if(hr<0)Marshal.ThrowExceptionForHR(hr);
    }

    public void Dispose()=>_serial.Dispose();

    private static class Native
    {
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_Open",CharSet=CharSet.Ansi)]
        public static extern int Open(out IntPtr handle,string name,IntPtr hwnd,
            uint userEvent,IntPtr eventHandle,uint configIndex);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_MapClientDataNameToID",CharSet=CharSet.Ansi)]
        public static extern int MapClientDataNameToID(IntPtr handle,string name,uint areaId);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_AddToClientDataDefinition")]
        public static extern int AddToClientDataDefinition(IntPtr handle,uint definitionId,
            uint offset,uint size,float epsilon,uint datumId);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_RequestClientData")]
        public static extern int RequestClientData(IntPtr handle,uint areaId,uint requestId,
            uint definitionId,uint period,uint flags,uint origin,uint interval,uint limit);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_SetClientData")]
        public static extern int SetClientData(IntPtr handle,uint areaId,uint definitionId,
            uint flags,uint reserved,uint size,ref A320WasmProtocol.Command data);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_GetNextDispatch")]
        public static extern int GetNextDispatch(IntPtr handle,out IntPtr data,out uint size);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_Close")]
        public static extern int Close(IntPtr handle);
    }
}
