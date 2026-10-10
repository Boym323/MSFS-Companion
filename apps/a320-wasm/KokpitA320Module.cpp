// Kokpit Asobo A320neo V1 - internal MSFS 2020 SDK WASM module.
// Compile with the Microsoft Flight Simulator 2020 SDK platform toolset.
// No arbitrary calculator script input, LVar writes or third-party process.
#include <MSFS/MSFS.h>
#include <MSFS/Legacy/gauges.h>
#include <SimConnect.h>
#include <cstdint>
#include <cstring>
#include <cstdio>

namespace {
constexpr DWORD kMagic = 0x4B413332; // "KA32"
constexpr DWORD kVersion = 1;
constexpr DWORD kCommandArea = 1;
constexpr DWORD kResponseArea = 2;
constexpr DWORD kCommandDefinition = 1;
constexpr DWORD kResponseDefinition = 2;
constexpr DWORD kCommandRequest = 1;
constexpr DWORD kFrameEvent = 1;
constexpr DWORD kCommandSize = 16;
constexpr DWORD kResponseSize = 16;

struct Command {
    DWORD magic;
    DWORD version;
    DWORD sequence;
    DWORD operation;
};
struct Reply {
    DWORD magic;
    DWORD version;
    DWORD sequence;
    DWORD result;
};
static_assert(sizeof(Command)==16, "Protocol must be fixed-size");
static_assert(sizeof(Reply)==16, "Protocol must be fixed-size");

HANDLE sim=nullptr;
DWORD lastSequence=0;

// These names appear in the official MSFS 2020 Asobo AIRBUS
// model-behavior Autopilot_Subtemplates. The module deliberately
// has NO arbitrary-code endpoint.
const char* Lookup(unsigned operation) {
    switch(operation) {
        case 1: return "(>H:A320_Neo_CDU_MODE_SELECTED_SPEED)";
        case 2: return "(>H:A320_Neo_CDU_MODE_MANAGED_SPEED)";
        case 3: return "(>H:A320_Neo_CDU_MODE_SELECTED_HEADING)";
        case 4: return "(>H:A320_Neo_CDU_MODE_MANAGED_HEADING)";
        case 5: return "(>H:A320_Neo_CDU_MODE_SELECTED_ALTITUDE)";
        case 6: return "(>H:A320_Neo_CDU_MODE_MANAGED_ALTITUDE)";
        default: return nullptr;
    }
}

void ReplyTo(DWORD sequence,DWORD status) {
    if(!sim)return;
    Reply result{kMagic,kVersion,sequence,status};
    SimConnect_SetClientData(sim,kResponseArea,kResponseDefinition,
        SIMCONNECT_CLIENT_DATA_SET_FLAG_DEFAULT,0,kResponseSize,&result);
}

void CALLBACK Dispatch(SIMCONNECT_RECV* data,DWORD size,void*) {
    if(!data)return;
    if(data->dwID==SIMCONNECT_RECV_ID_EVENT) {
        auto* event=reinterpret_cast<SIMCONNECT_RECV_EVENT*>(data);
        if(event->uEventID==kFrameEvent && sim)
            SimConnect_CallDispatch(sim,Dispatch,nullptr);
        return;
    }
    if(data->dwID!=SIMCONNECT_RECV_ID_CLIENT_DATA ||
       size<sizeof(SIMCONNECT_RECV_CLIENT_DATA)+kCommandSize-4)
        return;

    auto* received=reinterpret_cast<SIMCONNECT_RECV_CLIENT_DATA*>(data);
    if(received->dwRequestID!=kCommandRequest)return;
    Command command{};
    std::memcpy(&command,&received->dwData,sizeof(command));
    if(command.magic!=kMagic || command.version!=kVersion ||
       command.sequence==0 || command.sequence==lastSequence)
        return;
    lastSequence=command.sequence;

    if(command.operation==0) {
        ReplyTo(command.sequence,1); // Bridge exists, no aircraft action
        return;
    }
    const auto* script=Lookup(command.operation);
    if(!script) { ReplyTo(command.sequence,3); return; }
    const auto ok=execute_calculator_code(script,nullptr,nullptr,nullptr);
    ReplyTo(command.sequence,ok?1:2);
}

bool Initialize() {
    if(FAILED(SimConnect_Open(&sim,"Kokpit Asobo A320 H-Event Module",nullptr,0,nullptr,0)))
        return false;
    if(FAILED(SimConnect_MapClientDataNameToID(sim,"Kokpit.A320.Command.v1",kCommandArea)) ||
       FAILED(SimConnect_MapClientDataNameToID(sim,"Kokpit.A320.Response.v1",kResponseArea)) ||
       FAILED(SimConnect_CreateClientData(sim,kCommandArea,kCommandSize,
           SIMCONNECT_CREATE_CLIENT_DATA_FLAG_DEFAULT)) ||
       FAILED(SimConnect_CreateClientData(sim,kResponseArea,kResponseSize,
           SIMCONNECT_CREATE_CLIENT_DATA_FLAG_READ_ONLY)) ||
       FAILED(SimConnect_AddToClientDataDefinition(sim,kCommandDefinition,0,kCommandSize)) ||
       FAILED(SimConnect_AddToClientDataDefinition(sim,kResponseDefinition,0,kResponseSize)) ||
       FAILED(SimConnect_RequestClientData(sim,kCommandArea,kCommandRequest,
           kCommandDefinition,SIMCONNECT_CLIENT_DATA_PERIOD_ON_SET,
           SIMCONNECT_CLIENT_DATA_REQUEST_FLAG_DEFAULT)) ||
       FAILED(SimConnect_SubscribeToSystemEvent(sim,kFrameEvent,"Frame")))
        return false;
    // Drain data on the first dispatch and during subsequent simulator frames.
    return SUCCEEDED(SimConnect_CallDispatch(sim,Dispatch,nullptr));
}
}

extern "C" MSFS_CALLBACK void module_init(void) {
    if(!Initialize()) {
        std::fprintf(stderr,"Kokpit A320 WASM module initialization failed.\n");
        if(sim) { SimConnect_Close(sim);sim=nullptr; }
    }
}
extern "C" MSFS_CALLBACK void module_deinit(void) {
    if(sim) { SimConnect_Close(sim);sim=nullptr; }
}
