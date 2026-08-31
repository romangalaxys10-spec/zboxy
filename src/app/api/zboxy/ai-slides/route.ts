import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureUserDir } from '@/lib/zboxy';
import ZAI from 'z-ai-web-dev-sdk';

function getUser(req: NextRequest) {
  const token = req.headers.get('x-zboxy-token');
  if (!token) return null;
  return db.zboxyUser.findUnique({ where: { token } });
}

const TEMPLATE_STYLES: Record<string, string> = {
  business: 'Professional business presentation with data-driven content, clean hierarchy, and executive tone',
  creative: 'Creative and visually dynamic presentation with bold ideas, storytelling approach, and engaging narrative',
  minimal: 'Minimalist presentation with concise points, clean design, and focused messaging',
  academic: 'Academic/research presentation with structured arguments, evidence-based content, and scholarly tone',
  pitch: 'Startup pitch deck with problem-solution framework, market opportunity, and compelling call-to-action',
  education: 'Educational presentation with clear learning objectives, examples, and summary takeaways',
};

const SYSTEM_PROMPT = `You are a professional presentation content generator. You create well-structured slide content that is ready to use.

When generating slides, you MUST respond with valid JSON only (no markdown, no explanation). The JSON must be an array of slide objects.

Each slide object has this exact structure:
{
  "id": "slide-1",
  "elements": [
    {
      "id": "elem-1",
      "type": "text",
      "x": 8,
      "y": 25,
      "w": 84,
      "h": 20,
      "content": "Slide Title",
      "fontSize": 40,
      "fontWeight": "bold",
      "color": "#111827",
      "bgColor": "transparent",
      "textAlign": "center",
      "opacity": 1,
      "rotation": 0
    }
  ],
  "background": "#ffffff"
}

Rules:
- x, y, w, h are percentages (0-100)
- Title slides: large title at top, subtitle below
- Content slides: title at top, bullet points in body
- Use multiple text elements per slide for layout variety
- Keep text concise (no long paragraphs)
- Generate 5-8 slides for a complete presentation
- Every element must have all fields listed above
- First slide is always a title slide
- Last slide can be a summary or call-to-action
- Position text elements to avoid overlap (y positions should not collide)`;

// POST /api/zboxy/ai-slides — generate slides with AI
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, style, slideCount, folder } = await req.json();
    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const stylePrompt = TEMPLATE_STYLES[style] || TEMPLATE_STYLES.business;
    const count = Math.max(3, Math.min(12, slideCount || 6));

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate a ${count}-slide ${style || 'business'} presentation about: "${topic.trim()}"

Style: ${stylePrompt}

Remember: respond with valid JSON array only. No markdown fences, no extra text.`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    let rawContent = completion.choices[0]?.message?.content || '';
    // Strip markdown code fences if present
    rawContent = rawContent.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

    let slides;
    try {
      slides = JSON.parse(rawContent);
    } catch {
      // Try to extract JSON array from the response
      const match = rawContent.match(/\[[\s\S]*\]/);
      if (match) slides = JSON.parse(match[0]);
      else throw new Error('Failed to parse AI response as slide JSON');
    }

    if (!Array.isArray(slides) || slides.length === 0) {
      throw new Error('AI returned empty or invalid slides');
    }

    // Ensure each slide has required fields
    const validatedSlides = slides.map((s: Record<string, unknown>, i: number) => ({
      id: s.id || `slide-${i + 1}-${Date.now()}`,
      elements: (Array.isArray(s.elements) ? s.elements : []).map((e: Record<string, unknown>, j: number) => ({
        id: e.id || `elem-${i + 1}-${j + 1}-${Date.now()}`,
        type: e.type || 'text',
        x: typeof e.x === 'number' ? e.x : 8,
        y: typeof e.y === 'number' ? e.y : 10,
        w: typeof e.w === 'number' ? e.w : 80,
        h: typeof e.h === 'number' ? e.h : 10,
        content: String(e.content || ''),
        fontSize: typeof e.fontSize === 'number' ? e.fontSize : 20,
        fontWeight: e.fontWeight === 'bold' ? 'bold' : 'normal',
        color: typeof e.color === 'string' ? e.color : '#111827',
        bgColor: typeof e.bgColor === 'string' ? e.bgColor : 'transparent',
        textAlign: e.textAlign === 'center' ? 'center' : e.textAlign === 'right' ? 'right' : 'left',
        opacity: typeof e.opacity === 'number' ? e.opacity : 1,
        rotation: typeof e.rotation === 'number' ? e.rotation : 0,
      })),
      background: typeof s.background === 'string' ? s.background : '#ffffff',
    }));

    // Save as .zslide file
    await ensureUserDir(user.id);
    const fileName = `${topic.trim().slice(0, 40).replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}.zslide`;
    const folderPath = folder || '/';
    const content = JSON.stringify(validatedSlides);

    // Check for duplicate name
    const existing = await db.zboxyFile.findFirst({
      where: { userId: user.id, path: folderPath, name: fileName, trashed: false },
    });
    const finalName = existing ? `${fileName.replace('.zslide', '')}_${Date.now().toString(36)}.zslide` : fileName;

    const file = await db.zboxyFile.create({
      data: {
        userId: user.id,
        name: finalName,
        type: 'file',
        mimeType: 'application/x-zslide',
        path: folderPath,
        size: new TextEncoder().encode(content).length,
        content,
      },
    });

    return NextResponse.json({ success: true, file, slideCount: validatedSlides.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
