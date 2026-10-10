#pragma once
#include <cstdint>
// CI stubs permit source-level and opcode replay tests only.
using DWORD=uint32_t;
using HRESULT=int32_t;
using HANDLE=void*;
using HWND=void*;
#define CALLBACK
constexpr HRESULT S_OK=0;
inline bool FAILED(HRESULT hr){return hr<0;}
inline bool SUCCEEDED(HRESULT hr){return hr>=0;}
constexpr DWORD SIMCONNECT_RECV_ID_EVENT=4;
constexpr DWORD SIMCONNECT_RECV_ID_CLIENT_DATA=16;
constexpr DWORD SIMCONNECT_CREATE_CLIENT_DATA_FLAG_DEFAULT=0;
constexpr DWORD SIMCONNECT_CREATE_CLIENT_DATA_FLAG_READ_ONLY=1;
constexpr DWORD SIMCONNECT_CLIENT_DATA_SET_FLAG_DEFAULT=0;
constexpr DWORD SIMCONNECT_CLIENT_DATA_PERIOD_ON_SET=2;
constexpr DWORD SIMCONNECT_CLIENT_DATA_REQUEST_FLAG_DEFAULT=0;
struct SIMCONNECT_RECV{
    DWORD dwSize,dwVersion,dwID;
};
struct SIMCONNECT_RECV_EVENT:SIMCONNECT_RECV{
    DWORD uGroupID,uEventID,dwData;
};
struct SIMCONNECT_RECV_CLIENT_DATA:SIMCONNECT_RECV{
    DWORD dwRequestID,dwObjectID,dwDefineID,dwFlags,dwentryNumber,dwoutof,dwDefineCount,dwData;
};
static_assert(sizeof(SIMCONNECT_RECV_CLIENT_DATA)==44,"ABI stub packet size");
using SimDispatch=void (*)(SIMCONNECT_RECV*,DWORD,void*);
HRESULT SimConnect_Open(HANDLE*,const char*,HWND,DWORD,HANDLE,DWORD);
HRESULT SimConnect_Close(HANDLE);
HRESULT SimConnect_MapClientDataNameToID(HANDLE,const char*,DWORD);
HRESULT SimConnect_CreateClientData(HANDLE,DWORD,DWORD,DWORD);
HRESULT SimConnect_AddToClientDataDefinition(HANDLE,DWORD,DWORD,DWORD,float=0,DWORD=0);
HRESULT SimConnect_RequestClientData(HANDLE,DWORD,DWORD,DWORD,DWORD,DWORD=0,DWORD=0,DWORD=0,DWORD=0);
HRESULT SimConnect_SubscribeToSystemEvent(HANDLE,DWORD,const char*);
HRESULT SimConnect_SetClientData(HANDLE,DWORD,DWORD,DWORD,DWORD,DWORD,void*);
HRESULT SimConnect_CallDispatch(HANDLE,SimDispatch,void*);
