#include <cassert>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>
#include "../apps/a320-wasm/KokpitA320Module.cpp"

static int simulatorEvents=0;
static std::string lastScript;
static int acks=0;
static Reply lastReply{};

bool execute_calculator_code(const char* code,double*,int32_t*,const char**)
{
    lastScript=code;
    simulatorEvents++;
    return true;
}
HRESULT SimConnect_Open(HANDLE* out,const char*,HWND,DWORD,HANDLE,DWORD)
{
    *out=reinterpret_cast<HANDLE>(uintptr_t(1));return 0;
}
HRESULT SimConnect_Close(HANDLE){return 0;}
HRESULT SimConnect_MapClientDataNameToID(HANDLE,const char*,DWORD){return 0;}
HRESULT SimConnect_CreateClientData(HANDLE,DWORD,DWORD,DWORD){return 0;}
HRESULT SimConnect_AddToClientDataDefinition(HANDLE,DWORD,DWORD,DWORD,float,DWORD){return 0;}
HRESULT SimConnect_RequestClientData(HANDLE,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD,DWORD){return 0;}
HRESULT SimConnect_SubscribeToSystemEvent(HANDLE,DWORD,const char*){return 0;}
HRESULT SimConnect_SetClientData(HANDLE,DWORD,DWORD,DWORD,DWORD,DWORD size,void* data)
{
    assert(size==sizeof(Reply));
    std::memcpy(&lastReply,data,sizeof(lastReply));
    acks++;
    return 0;
}
HRESULT SimConnect_CallDispatch(HANDLE,SimDispatch,void*){return 0;}

struct WirePacket {
    SIMCONNECT_RECV_CLIENT_DATA header;
    DWORD extra[3];
};
static_assert(sizeof(WirePacket)>=56,"A320 test wire packet size");

static void Send(DWORD sequence,DWORD op,DWORD magic=kMagic,DWORD version=kVersion)
{
    WirePacket packet{};
    packet.header.dwID=SIMCONNECT_RECV_ID_CLIENT_DATA;
    packet.header.dwRequestID=kCommandRequest;
    const Command command{magic,version,sequence,op};
    std::memcpy(&packet.header.dwData,&command,sizeof(command));
    Dispatch(&packet.header,sizeof(packet),nullptr);
}

int main()
{
    module_init();
    assert(sim!=nullptr);
    Send(1,0);
    assert(acks==1 && simulatorEvents==0 && lastReply.sequence==1 && lastReply.result==1);
    const char* scripts[]={
        "(>H:A320_Neo_CDU_MODE_SELECTED_SPEED)",
        "(>H:A320_Neo_CDU_MODE_MANAGED_SPEED)",
        "(>H:A320_Neo_CDU_MODE_SELECTED_HEADING)",
        "(>H:A320_Neo_CDU_MODE_MANAGED_HEADING)",
        "(>H:A320_Neo_CDU_MODE_SELECTED_ALTITUDE)",
        "(>H:A320_Neo_CDU_MODE_MANAGED_ALTITUDE)"
    };
    for(unsigned i=1;i<=6;i++){
        Send(i+1,i);
        assert(acks==static_cast<int>(i+1));
        assert(simulatorEvents==static_cast<int>(i));
        assert(lastScript==scripts[i-1]);
        assert(lastReply.result==1);
    }
    Send(7,6); // replay: never execute twice
    assert(simulatorEvents==6 && acks==7);
    Send(8,777); // unknown op refused
    assert(simulatorEvents==6 && acks==8 && lastReply.result==3);
    Send(9,1,0); // bad magic ignored, not executed
    Send(10,1,kMagic,4); // unsupported protocol ignored
    assert(simulatorEvents==6 && acks==8);
    module_deinit();
    assert(sim==nullptr);
    std::cout<<"PASS: WASM fixed H-event allowlist, ping, replay and bad packets"<<std::endl;
    return 0;
}
