using System.Runtime.InteropServices;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>Fixed-size wire protocol for Kokpit's optional in-sim WASM module.</summary>
public static class A320WasmProtocol
{
    public const uint Magic = 0x4B413332;
    public const uint Version = 1;
    public const string CommandChannel = "Kokpit.A320.Command.v1";
    public const string ResponseChannel = "Kokpit.A320.Response.v1";
    public const int WireSize = 16;

    [StructLayout(LayoutKind.Sequential, Pack=1)]
    public struct Command
    {
        public uint Magic;
        public uint Version;
        public uint Sequence;
        public uint Operation;
    }

    [StructLayout(LayoutKind.Sequential, Pack=1)]
    public struct Reply
    {
        public uint Magic;
        public uint Version;
        public uint Sequence;
        public uint Status;
    }

    public sealed record Action(string Name,uint Operation);
    private static readonly Action[] Known =
    [
        new("a320.fcu.speed.selected",1),
        new("a320.fcu.speed.managed",2),
        new("a320.fcu.heading.selected",3),
        new("a320.fcu.heading.managed",4),
        new("a320.fcu.altitude.selected",5),
        new("a320.fcu.altitude.managed",6)
    ];

    public static IReadOnlyList<string> AvailableActions =>
        Known.Select(x=>x.Name).ToArray();

    public static bool TryResolve(string? command,out uint operation)
    {
        operation=0;
        var match=Known.FirstOrDefault(x=>x.Name==command);
        if(match is null)return false;
        operation=match.Operation;
        return true;
    }

    public static bool Valid(Reply reply,uint expectedSequence) =>
        expectedSequence!=0 && reply.Magic==Magic &&
        reply.Version==Version && reply.Sequence==expectedSequence &&
        reply.Status is 1 or 2 or 3;
}
