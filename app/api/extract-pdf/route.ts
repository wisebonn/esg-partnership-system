import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new NextResponse("No file uploaded", { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return NextResponse.json({ text: result.text });
    } finally {
      await parser.destroy();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Failed to read PDF: ${msg}`, { status: 500 });
  }
}