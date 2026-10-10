#pragma once
#include <cstdint>
// CI-only ABI stub, not the simulator gauge engine.
bool execute_calculator_code(const char* code,double* fvalue,
    int32_t* ivalue,const char** svalue);
