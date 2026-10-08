using System.Buffers.Binary;
using MsfsCompanion.Bridge.Traffic;
static void Check(bool value,string what){if(!value)throw new Exception("C26 "+what);}
static byte[] Packet(uint request,double latitude=50.1)
{
 var bytes=new byte[TrafficPacketDecoder.ExpectedBytes];
 void Write(int offset,uint value)=>BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(offset,4),value);
 Write(0,(uint)bytes.Length);Write(8,9);Write(12,request);Write(16,213);
 Write(28,0);Write(32,1);Write(36,6);
 double[] values=[latitude,14.2,4500,110,132,0];
 for(int i=0;i<values.Length;i++)BinaryPrimitives.WriteInt64LittleEndian(
    bytes.AsSpan(40+i*8,8),BitConverter.DoubleToInt64Bits(values[i]));
 return bytes;
}
Check(!TrafficPacketDecoder.TryDecode(Packet(17),18,out _),"wrong request");
Check(!TrafficPacketDecoder.TryDecode(Packet(17).AsSpan(0,50),17,out _),"short packet");
Check(!TrafficPacketDecoder.TryDecode(Packet(17,900),17,out _),"invalid latitude");
Check(TrafficPacketDecoder.TryDecode(Packet(17),17,out var sample)&&sample is not null,
    "one valid object");
Check(sample!.Target.ObjectId==213&&sample.Target.Latitude==50.1,"parsed object");
var state=new SimTrafficState();
var before=state.Snapshot(DateTimeOffset.UtcNow);
Check(before.ToString()!.Contains("available = False"),"not initially available");
var now=DateTimeOffset.UtcNow;
state.Begin(17);state.Accept(sample,now);
Check(state.Snapshot(now).ToString()!.Contains("available = True"),"confirmed batch");
Check(state.Snapshot(now.AddSeconds(30)).ToString()!.Contains("available = False"),"stale hidden");
state.Reset();
Check(state.Snapshot(now).ToString()!.Contains("not_requested"),"disconnected");
Console.WriteLine("PASS: C26 SimConnect bytype packet validation and stale traffic state.");
