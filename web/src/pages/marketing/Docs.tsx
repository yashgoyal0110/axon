import { useEffect, useState } from 'react';
// TODO: extract this into a shared helper
// TODO: replace the any casts with real types
// FIXME: blows up on an empty payload
import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, Terminal } from 'lucide-react';
import { Badge, Button, Card, Reveal, SectionHeading } from '@/components/ui';
import { cn, copyToClipboard } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Section {
  id: string;
  title: string;
  blocks: Array<
    | { kind: 'p'; text: string }
    | { kind: 'code'; lang: string; text: string }
    | { kind: 'list'; items: string[] }
    | { kind: 'note'; text: string }
  >;
}

const SECTIONS: Section[] = [
  {
    id: 'quickstart',
    title: 'Quickstart',
    blocks: [
      {
        kind: 'p',
        text: 'Axon runs as a single container: the NestJS API serves the React app on the same port. Postgres is required; Redis is optional and only sharpens caching and rate limiting across replicas.',
      },
      {
        kind: 'code',
        lang: 'bash',
        text: `git clone <your-fork> axon && cd axon
cp .env.example .env          # set GEMINI_API_KEY to enable AI
docker compose up -d --build

# → http://localhost:6002
# → sign in with demo@axon.app / demo1234`,
      },
      {
        kind: 'note',
        text: 'Without GEMINI_API_KEY the platform still runs end to end. AI steps fall back to the flow\'s configured message instead of failing.',
      },
    ],
  },
  {
    id: 'sandbox',
    title: 'Sandbox mode',
    blocks: [
      {
        kind: 'p',
        text: 'Every new workspace is created with a sandbox channel. It exercises the same engine a real webhook does - contact resolution, session windows, node traversal, AI fallback, quota metering and analytics - with no provider attached.',
      },
      {
        kind: 'list',
        items: [
          'Open Simulator in the app sidebar',
          'Type as if you were a WhatsApp contact',
          'Watch the flow advance node by node, including AI replies',
          'Reset the session at any time to start over',
        ],
      },
      {
        kind: 'p',
        text: 'Conversations created in the sandbox appear in the inbox and count toward analytics exactly like production traffic, so the dashboard is meaningful from minute one.',
      },
    ],
  },
  {
    id: 'channels',
    title: 'Connecting a real number',
    blocks: [
      {
        kind: 'p',
        text: 'Two providers are supported. Both are configured in Settings → Channels, and both give you a webhook URL to paste into the provider console.',
      },
      { kind: 'p', text: 'Meta Cloud API - direct from Meta, with interactive reply buttons:' },
      {
        kind: 'list',
        items: [
          'Create an app at developers.facebook.com and add the WhatsApp product',
          'Copy the Phone number ID and generate a permanent System User access token',
          'Add the App secret so inbound webhooks can be signature-verified',
          'Paste the webhook URL and verify token from Axon into the app\'s webhook configuration',
        ],
      },
      { kind: 'p', text: 'Twilio - fastest if you already have a Twilio number or their WhatsApp sandbox:' },
      {
        kind: 'list',
        items: [
          'Copy your Account SID and Auth token from the Twilio console',
          'Set the WhatsApp sender, e.g. +14155238886',
          'Point "When a message comes in" at the webhook URL Axon gives you',
        ],
      },
      {
        kind: 'note',
        text: 'Credentials are encrypted with AES-256-GCM before they touch the database and are never returned by the API - the UI only reports which fields are populated.',
      },
    ],
  },
  {
    id: 'nodes',
    title: 'Node reference',
    blocks: [
      {
        kind: 'list',
        items: [
          'Start: the single entry point. Every flow needs exactly one.',
          'Message: sends text and moves on without waiting.',
          'Question: sends text plus up to three quick replies, then waits. Replies match by exact text, by number, or by substring.',
          'Capture: sends a prompt, waits, and stores the raw reply in a named variable.',
          'AI: asks Gemini with the conversation history and the flow persona, sends the answer, then continues.',
          'Condition: evaluates rules against captured variables top-down; the first match wins, otherwise the else branch is taken.',
          'Handoff: parks the conversation for a human agent; the bot stops replying.',
          'End: sends a closing message and marks the conversation complete.',
        ],
      },
      {
        kind: 'p',
        text: 'Any message body can interpolate captured values with double braces, for example: "Thanks {{contactName}}, sending the quote to {{email}} now."',
      },
    ],
  },
  {
    id: 'api',
    title: 'REST API',
    blocks: [
      {
        kind: 'p',
        text: 'Everything the dashboard does is available over HTTP. Authenticate with a bearer token from /api/auth/login, or with a workspace API key for machine-to-machine access.',
      },
      {
        kind: 'code',
        lang: 'bash',
        text: `# Create a key in Settings → API keys, then:
curl https://your-host/api/flows \\
  -H "x-api-key: ax_<prefix>_<secret>"

# Send a message through the engine on a sandbox channel
curl -X POST https://your-host/api/conversations/simulate \\
  -H "x-api-key: ax_<prefix>_<secret>" \\
  -H "content-type: application/json" \\
  -d '{"text":"hello","waId":"+15550000001"}'`,
      },
      {
        kind: 'p',
        text: 'The full OpenAPI schema is served live at /api/docs, including request bodies, response shapes and both auth schemes.',
      },
    ],
  },
  {
    id: 'limits',
    title: 'Rate limits and quotas',
    blocks: [
      {
        kind: 'list',
        items: [
          'Global throttle: 240 requests per minute per IP by default (THROTTLE_LIMIT / THROTTLE_TTL).',
          'Credential endpoints: 10 attempts per minute.',
          'Simulator: 60 messages per minute, because each one can trigger an AI call.',
          'Provider webhooks: 600 per minute, high enough to absorb a burst without being unbounded.',
          'Plan quotas: monthly message and AI-call ceilings, metered live and visible on the billing page.',
        ],
      },
      {
        kind: 'p',
        text: 'When a quota is exhausted the outbound message is still recorded, marked FAILED with the reason attached, so nothing vanishes without a trace.',
      },
    ],
  },
  {
    id: 'env',
    title: 'Environment variables',
    blocks: [
      {
        kind: 'code',
        lang: 'bash',
        text: `PORT=6002                       # the single port everything is served on
DATABASE_URL=postgresql://…     # required
PUBLIC_URL=https://your-host    # used for webhook + invite URLs
JWT_SECRET=…                    # auto-generated by the entrypoint if unset
APP_ENCRYPTION_KEY=…            # 64 hex chars; encrypts channel credentials
GEMINI_API_KEY=…                # optional; enables AI replies and generation
GEMINI_MODEL=gemini-2.5-flash
ENABLE_REDIS=true
REDIS_URL=redis://redis:6379
THROTTLE_LIMIT=240
THROTTLE_TTL=60
SIGNUPS_ENABLED=true`,
      },
    ],
  },
];

export default function Docs() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const observerValue = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observerValue.observe(el);
    });
    return () => observerValue.disconnect();
  }, []);

  return (
    <div className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Documentation"
          title="Everything you need to run it"
          description="Setup, channel configuration, the node reference and the API surface - enough to take this from clone to production."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="space-y-0.5">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={cn(
                    'block rounded-lg border-l-2 px-3 py-2 text-[13px] transition-colors',
                    active === section.id
                      ? 'border-mint-400 bg-mint-400/[0.07] font-medium text-mint-300'
                      : 'border-transparent text-slate-500 hover:text-slate-300',
                  )}
                >
                  {section.title}
                </a>
              ))}
            </nav>

            <a href="/api/docs" target="_blank" rel="noreferrer" className="mt-6 block">
              <Button variant="secondary" size="sm" className="w-full" iconRight={ExternalLink}>
                OpenAPI explorer
              </Button>
            </a>
          </aside>

          <div className="min-w-0 space-y-14">
            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold text-white">
                  <BookOpen className="h-5 w-5 text-mint-400" />
                  {section.title}
                </h2>

                <div className="mt-5 space-y-4">
                  {section.blocks.map((block, index) => {
                    if (block.kind === 'p') {
                      return (
                        <p key={index} className="text-[14.5px] leading-relaxed text-slate-400">
                          {block.text}
                        </p>
                      );
                    }
                    if (block.kind === 'list') {
                      return (
                        <ul key={index} className="space-y-2">
                          {block.items.map((item) => (
                            <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-slate-400">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mint-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    if (block.kind === 'note') {
                      return (
                        <div
                          key={index}
                          className="rounded-xl border border-mint-400/20 bg-mint-400/[0.06] px-4 py-3 text-[13.5px] leading-relaxed text-mint-200/90"
                        >
                          {block.text}
                        </div>
                      );
                    }
                    return <CodeBlock key={index} lang={block.lang} code={block.text} />;
                  })}
                </div>
              </section>
            ))}

            <Reveal>
              <Card className="p-6">
                <h3 className="font-display text-lg font-bold text-white">Ready to build?</h3>
                <p className="mt-2 text-[14px] text-slate-400">
                  Create a workspace and load a template - the sandbox channel is already waiting for you.
                </p>
                <Link to="/register" className="mt-5 inline-block">
                  <Button>Create your workspace</Button>
                </Link>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-ink-950/70">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-slate-600" />
          <Badge tone="slate">{lang}</Badge>
        </div>
        <button
          onClick={async () => {
            const ok = await copyToClipboard(code);
            toast[ok ? 'success' : 'error'](ok ? 'Copied' : 'Copy failed');
          }}
          className="text-[11.5px] font-medium text-slate-500 opacity-0 transition-opacity hover:text-mint-300 group-hover:opacity-100"
        >
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5">
        <code className="font-mono text-[12.5px] leading-relaxed text-slate-300">{code}</code>
      </pre>
    </div>
  );
}


// kept around until the new implementation is verified
function legacyCodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-ink-950/70">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-slate-600" />
          <Badge tone="slate">{lang}</Badge>
        </div>
        <button
          onClick={async () => {
            const ok = await copyToClipboard(code);
            toast[ok ? 'success' : 'error'](ok ? 'Copied' : 'Copy failed');
          }}
          className="text-[11.5px] font-medium text-slate-500 opacity-0 transition-opacity hover:text-mint-300 group-hover:opacity-100"
        >
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5">
        <code className="font-mono text-[12.5px] leading-relaxed text-slate-300">{code}</code>
      </pre>
    </div>
  );
}