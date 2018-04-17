import { MuSchema } from 'muschema/schema';
import { MuStruct } from 'muschema/struct';
import { MuUint32 } from 'muschema/uint32';
import { MuString } from 'muschema/string';
import { MuAnyMessageTable } from '../../mudb/protocol';

export type MuAnySchema = MuSchema<any>;
export type MuRPCSchema = { 0:MuAnySchema, 1:MuAnySchema } | [ MuAnySchema, MuAnySchema ];
export type MuRPCTable = { [method:string]:MuRPCSchema };

export type MuRPCProtocolSchema = {
    client:MuRPCTable;
    server:MuRPCTable;
};

export type MuRPCError = string;

export interface MuRPCInterface<RPCTable extends MuRPCTable> {
    callAPI:{
        [method in keyof RPCTable]:(
            arg:RPCTable[method]['0']['identity'],
            next?:(err:MuRPCError|undefined, response?:RPCTable[method]['1']['identity']) => void) => void
    };
    handlerAPI:{
        [method in keyof RPCTable]:(
            arg:RPCTable[method]['0']['identity'],
            next:(err:MuRPCError|undefined, response?:RPCTable[method]['1']['identity']) => void) => void
    };
}

export type MuRPCProtocolTablePhase<RPCTable extends MuRPCTable, Phase extends '0' | '1'> = {
    [method in keyof RPCTable]:MuStruct<{
        base:RPCTable[method][Phase];
        id:MuUint32;
    }>;
};

export interface MuRPCProtocolSchemaUnfolded<ProtocolSchema extends MuRPCProtocolSchema> {
    '0':{
        client:MuRPCProtocolTablePhase<ProtocolSchema['client'], '0'>;
        server:MuRPCProtocolTablePhase<ProtocolSchema['server'], '0'>;
    };
    '1':{
        client:MuRPCProtocolTablePhase<ProtocolSchema['server'], '1'>;
        server:MuRPCProtocolTablePhase<ProtocolSchema['client'], '1'>;
    };
}

export function unfoldRPCProtocolSchema<ProtocolSchema extends MuRPCProtocolSchema> (
    schema:ProtocolSchema,
) : MuRPCProtocolSchemaUnfolded<ProtocolSchema> {
    const result = <MuRPCProtocolSchemaUnfolded<ProtocolSchema>>{
        0: { client: {}, server: {} },
        1: { client: {}, server: {} },
    };
    const CallbackIDSchema = new MuUint32();

    Object.keys(schema.client).forEach((method) => {
        result[0].client[method] = new MuStruct({
            base: schema.client[method][0],
            id: CallbackIDSchema,
        });
        result[1].server[method] = new MuStruct({
            base: schema.client[method][1],
            id: CallbackIDSchema,
        });
    });
    Object.keys(schema.server).forEach((method) => {
        result[0].server[method] = new MuStruct({
            base: schema.server[method][0],
            id: CallbackIDSchema,
        });
        result[1].client[method] = new MuStruct({
            base: schema.server[method][1],
            id: CallbackIDSchema,
        });
    });

    return result;
}

export const MuRPCErrorSchema = new MuStruct({
    message: new MuString(),
    id: new MuUint32(),
});

export const MuRPCErrorProtocolSchema = {
    client: {
        error: MuRPCErrorSchema,
    },
    server: {
        error: MuRPCErrorSchema,
    },
};
