import { MuSchema } from '../schema/schema';
import { MuStruct } from '../schema/struct';
import { MuUint32 } from '../schema/uint32';
import { MuUTF8 } from '../schema/utf8';
import { MuRPCRemoteClient } from './server';

// Remote Procedure Call, a response-request protocol
export namespace MuRPC {
    export type Schema = [MuSchema<any>, MuSchema<any>];
    export type SchemaTable = { [proc:string]:Schema };
    export type ProtocolSchema = {
        name?:string,
        client:SchemaTable;
        server:SchemaTable;
    };

    type Req = 0;
    type Res = 1;
    type Phase = Req | Res;

    type MaybeError = string | undefined;

    export type API<Table extends SchemaTable> = {
        caller:{
            [proc in keyof Table]:(
                arg:Table[proc][Req]['identity'],
                callback:(ret:Table[proc][Res]['identity']) => void,
            ) => void
        };
        clientProcedure:{
            [proc in keyof Table]:(
                arg:Table[proc][Req]['identity'],
                next:(err:MaybeError, ret?:Table[proc][Res]['identity']) => void,
            ) => void
        };
        serverProcedure:{
            [proc in keyof Table]:(
                arg:Table[proc][Req]['identity'],
                next:(err:MaybeError, ret?:Table[proc][Res]['identity']) => void,
                client?:MuRPCRemoteClient<Table>,
            ) => void
        }
    };

    type CallbackSchemaTable<Table extends SchemaTable, P extends Phase> = {
        [proc in keyof Table]:MuStruct<{
            id:MuUint32;
            base:Table[proc][P];
        }>
    };

    export type TransposedProtocolSchema<S extends ProtocolSchema> = [
        {
            name?:string;
            client:CallbackSchemaTable<S['client'], Req>;
            server:CallbackSchemaTable<S['server'], Req>;
        },
        {
            name?:string;
            client:CallbackSchemaTable<S['client'], Res>;
            server:CallbackSchemaTable<S['server'], Res>;
        }
    ];

    export function transpose <S extends ProtocolSchema> (
        protocolSchema:S,
    ) : TransposedProtocolSchema<S> {
        // tuple type is not inferred
        const transposed = [
            { client: {}, server: {} }, // request protocol schema
            { client: {}, server: {} }, // response protocol schema
        ] as TransposedProtocolSchema<S>;

        const req:Req = 0;
        const res:Res = 1;
        const callbackIdSchema = new MuUint32();

        Object.keys(protocolSchema.client).forEach((proc) => {
            const reqRes = protocolSchema.client[proc];
            transposed[req].client[proc] = new MuStruct({
                id: callbackIdSchema,
                base: reqRes[req],
            });
            transposed[res].server[proc] = new MuStruct({
                id: callbackIdSchema,
                base: reqRes[res],
            });
        });
        Object.keys(protocolSchema.server).forEach((proc) => {
            const reqRes = protocolSchema.server[proc];
            transposed[req].server[proc] = new MuStruct({
                id: callbackIdSchema,
                base: reqRes[req],
            });
            transposed[res].client[proc] = new MuStruct({
                id: callbackIdSchema,
                base: reqRes[res],
            });
        });

        if (protocolSchema.name) {
            const name = protocolSchema.name;
            transposed[req].name = `${name}Request`;
            transposed[res].name = `${name}Response`;
        }

        return transposed;
    }

    const errorSchema = new MuStruct({
        id: new MuUint32(),
        message: new MuUTF8(),
    });

    export type ErrorProtocolSchema = {
        name?:string;
        client:{ error:typeof errorSchema };
        server:{ error:typeof errorSchema };
    };

    export function createErrorProtocolSchema (
        protocolSchema:ProtocolSchema,
    ) : ErrorProtocolSchema {
        const schema = {
            client: { error: errorSchema },
            server: { error: errorSchema },
        } as ErrorProtocolSchema;

        if (protocolSchema.name) {
            schema.name = `${protocolSchema.name}Error`;
        }
        return schema;
    }
}
