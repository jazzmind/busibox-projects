import { NextResponse } from 'next/server';
import { exportTemplate } from '@/lib/markdown-io';

export async function GET() {
  const template = exportTemplate();

  return new NextResponse(template, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="busibox-projects-template.md"',
    },
  });
}
