import { NextResponse } from "next/server";
export async function POST(){return NextResponse.json({error:"Continue with SOVSI ID.",code:"SOVSI_ID_REQUIRED"},{status:410,headers:{"Cache-Control":"no-store"}});}
