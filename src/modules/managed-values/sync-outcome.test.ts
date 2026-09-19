import { describe, it, expect } from "vitest";
import { syncOutcome } from "./sync-outcome";
describe("CMS operation outcome", () => {
  it("does not equate confirmation or completed processing with successful CMS sync", () => {
    expect(syncOutcome({status:"confirmed",cursor:0,total:2,results:[]})).toMatchObject({label:"Na fila do servidor",verified:0,remaining:2});
    expect(syncOutcome({status:"completed",cursor:2,total:2,results:[{status:"applied"},{status:"conflict"}]})).toMatchObject({label:"Encerrada com pendências",verified:1,issues:1,badge:"conflict"});
    expect(syncOutcome({status:"completed",cursor:2,total:2,results:[{status:"applied"},{status:"already_applied"}]})).toMatchObject({label:"Verificada no CMS",verified:2,issues:0});
    expect(syncOutcome({status:"completed",cursor:2,total:2,results:[]})).toMatchObject({label:"Encerrada com pendências",verified:0});
  });
});
