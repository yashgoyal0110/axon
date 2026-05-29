import { FlowGraph } from '../engine/graph.types';

export interface FlowTemplate {
  key: string;
  name: string;
  category: string;
  description: string;
  accent: string;
  aiPersona: string;
  triggerKeywords: string[];
  graph: FlowGraph;
}

const COL = 340;
const ROW = 200;

function at(col: number, row: number) {
  return { x: col * COL, y: row * ROW };
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    key: 'lead_gen',
    name: 'Lead qualification',
    category: 'Sales',
    description: 'Qualify inbound interest by need and budget, then capture an email for follow-up.',
    accent: '#22d3ee',
    aiPersona:
      'You are a friendly B2B sales assistant. Qualify the lead politely, never pressure, and hand off to a human for pricing specifics.',
    triggerKeywords: ['hi', 'hello', 'pricing', 'quote'],
    graph: {
      nodes: [
        { id: 'start', type: 'start', position: at(0, 1), data: { label: 'Start', triggers: ['hi', 'hello', 'pricing'] } },
        {
          id: 'greet',
          type: 'message',
          position: at(1, 1),
          data: { label: 'Greeting', text: 'Hi {{contactName}} 👋 Thanks for reaching out. I can get you a tailored quote in about a minute.' },
        },
        {
          id: 'need',
          type: 'question',
          position: at(2, 1),
          data: {
            label: 'Need',
            text: 'What are you looking for help with?',
            responses: ['Software development', 'Marketing campaign', 'Business consulting'],
            variable: 'need',
          },
        },
        {
          id: 'budget',
          type: 'question',
          position: at(3, 1),
          data: {
            label: 'Budget',
            text: 'Got it - {{need}}. Roughly what monthly budget are you working with?',
            responses: ['Under $2,000', '$2,000 – $10,000', 'Above $10,000'],
            variable: 'budget',
          },
        },
        {
          id: 'email',
          type: 'capture',
          position: at(4, 1),
          data: {
            label: 'Capture email',
            text: 'Perfect. What email should we send the proposal to?',
            variable: 'email',
          },
        },
                {
                    id: 'route',
                    type: 'condition',
                    position: at(5, 1),
                    data: {
                        label: 'Priority routing',
                        conditions: [{ variable: 'budget', operator: 'contains', value: 'above', label: 'High value' }],
                    },
                },
                {
                    id: 'handoff',
                    type: 'handoff',
                    position: at(6, 0),
                    data: {
                        label: 'Senior AE',
            text: 'Thanks! Given the scope, I am connecting you with a senior account executive right now.',
          },
        },
        {
          id: 'done',
          type: 'end',
          position: at(6, 2),
          data: { label: 'Done', text: 'All set - the proposal is on its way to {{email}}. Anything else I can help with?' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'greet' },
        { id: 'e2', source: 'greet', target: 'need' },
        { id: 'e3', source: 'need', target: 'budget', sourceHandle: 'response-0', label: 'Software development' },
        { id: 'e4', source: 'need', target: 'budget', sourceHandle: 'response-1', label: 'Marketing campaign' },
        { id: 'e5', source: 'need', target: 'budget', sourceHandle: 'response-2', label: 'Business consulting' },
        { id: 'e6', source: 'budget', target: 'email', sourceHandle: 'response-0', label: 'Under $2,000' },
        { id: 'e7', source: 'budget', target: 'email', sourceHandle: 'response-1', label: '$2,000 – $10,000' },
        { id: 'e8', source: 'budget', target: 'email', sourceHandle: 'response-2', label: 'Above $10,000' },
        { id: 'e9', source: 'email', target: 'route' },
        { id: 'e10', source: 'route', target: 'handoff', sourceHandle: 'condition-0', label: 'High value' },
        { id: 'e11', source: 'route', target: 'done', sourceHandle: 'condition-else', label: 'Otherwise' },
      ],
    },
  },

  {
    key: 'ecommerce',
    name: 'Coffee ordering bot',
    category: 'Commerce',
    description: 'Take a drink order, confirm size and pickup time, and close with an order summary.',
    accent: '#f59e0b',
    aiPersona:
      'You are a cheerful barista taking orders over WhatsApp. Keep it short, upbeat, and never promise items that are not on the menu.',
    triggerKeywords: ['order', 'menu', 'coffee'],
    graph: {
      nodes: [
        { id: 'start', type: 'start', position: at(0, 1), data: { label: 'Start', triggers: ['order', 'menu'] } },
        {
          id: 'menu',
          type: 'question',
          position: at(1, 1),
          data: {
            label: 'Drink',
            text: 'Morning ☕ What can we make for you today?',
            responses: ['Espresso', 'Filter coffee', 'Cold brew'],
            variable: 'drink',
          },
        },
        {
          id: 'size',
          type: 'question',
          position: at(2, 1),
          data: {
            label: 'Size',
            text: 'One {{drink}} coming up. Which size?',
            responses: ['Small', 'Medium', 'Large'],
            variable: 'size',
          },
        },
        {
          id: 'pickup',
          type: 'question',
          position: at(3, 1),
          data: {
            label: 'Pickup',
            text: 'When would you like it ready?',
            responses: ['ASAP', 'In 15 minutes', 'In 30 minutes'],
            variable: 'pickup',
          },
        },
        {
          id: 'name',
          type: 'capture',
          position: at(4, 1),
          data: { label: 'Name for the cup', text: 'Last thing - what name should we put on the cup?', variable: 'orderName' },
        },
        {
          id: 'confirm',
          type: 'end',
          position: at(5, 1),
          data: {
            label: 'Confirm',
            text: 'Order in! {{size}} {{drink}} for {{orderName}}, ready {{pickup}}. See you soon 👋',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'menu' },
        { id: 'e2', source: 'menu', target: 'size', sourceHandle: 'response-0', label: 'Espresso' },
        { id: 'e3', source: 'menu', target: 'size', sourceHandle: 'response-1', label: 'Filter coffee' },
        { id: 'e4', source: 'menu', target: 'size', sourceHandle: 'response-2', label: 'Cold brew' },
        { id: 'e5', source: 'size', target: 'pickup', sourceHandle: 'response-0', label: 'Small' },
        { id: 'e6', source: 'size', target: 'pickup', sourceHandle: 'response-1', label: 'Medium' },
        { id: 'e7', source: 'size', target: 'pickup', sourceHandle: 'response-2', label: 'Large' },
        { id: 'e8', source: 'pickup', target: 'name', sourceHandle: 'response-0', label: 'ASAP' },
        { id: 'e9', source: 'pickup', target: 'name', sourceHandle: 'response-1', label: 'In 15 minutes' },
        { id: 'e10', source: 'pickup', target: 'name', sourceHandle: 'response-2', label: 'In 30 minutes' },
        { id: 'e11', source: 'name', target: 'confirm' },
      ],
    },
  },

  {
    key: 'faq_support',
    name: 'Support triage',
    category: 'Support',
    description: 'Deflect common questions with AI, and escalate anything else to a human agent.',
    accent: '#a78bfa',
    aiPersona:
      'You are a calm, precise support agent. Answer from what you know, admit uncertainty, and offer escalation instead of guessing.',
    triggerKeywords: ['help', 'support', 'issue', 'problem'],
    graph: {
      nodes: [
        { id: 'start', type: 'start', position: at(0, 1), data: { label: 'Start', triggers: ['help', 'support'] } },
        {
          id: 'topic',
          type: 'question',
          position: at(1, 1),
          data: {
            label: 'Topic',
            text: 'Hi! What do you need a hand with?',
            responses: ['Order status', 'Billing question', 'Something else'],
            variable: 'topic',
          },
        },
        {
          id: 'orderId',
          type: 'capture',
          position: at(2, 0),
          data: { label: 'Order number', text: 'Sure - what is your order number?', variable: 'orderId' },
        },
        {
          id: 'orderReply',
          type: 'end',
          position: at(3, 0),
          data: {
            label: 'Order status sent',
            text: 'Thanks. Order {{orderId}} is being looked up and an update will land here shortly.',
          },
        },
        {
          id: 'billing',
          type: 'handoff',
          position: at(2, 1),
          data: {
            label: 'Billing handoff',
            text: 'Billing questions go straight to a specialist - connecting you now.',
          },
        },
        {
          id: 'ask',
          type: 'capture',
          position: at(2, 2),
          data: { label: 'Free text', text: 'No problem - tell me what is going on and I will do my best.', variable: 'issue' },
        },
        {
          id: 'aiAnswer',
          type: 'ai',
          position: at(3, 2),
          data: {
            label: 'AI answer',
            aiPrompt: 'The customer said: "{{issue}}". Answer helpfully in under 50 words.',
          },
        },
        {
          id: 'resolved',
          type: 'question',
          position: at(4, 2),
          data: {
            label: 'Resolved?',
            text: 'Did that answer your question?',
            responses: ['Yes, thanks', 'No, I need a human'],
            variable: 'resolved',
          },
        },
        { id: 'close', type: 'end', position: at(5, 1), data: { label: 'Close', text: 'Glad that helped. Have a great day! 🙌' } },
        {
          id: 'escalate',
          type: 'handoff',
          position: at(5, 3),
          data: { label: 'Escalate', text: 'Understood - putting you through to a support agent now.' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'topic' },
        { id: 'e2', source: 'topic', target: 'orderId', sourceHandle: 'response-0', label: 'Order status' },
        { id: 'e3', source: 'topic', target: 'billing', sourceHandle: 'response-1', label: 'Billing question' },
        { id: 'e4', source: 'topic', target: 'ask', sourceHandle: 'response-2', label: 'Something else' },
        { id: 'e5', source: 'orderId', target: 'orderReply' },
        { id: 'e6', source: 'ask', target: 'aiAnswer' },
        { id: 'e7', source: 'aiAnswer', target: 'resolved' },
        { id: 'e8', source: 'resolved', target: 'close', sourceHandle: 'response-0', label: 'Yes, thanks' },
        { id: 'e9', source: 'resolved', target: 'escalate', sourceHandle: 'response-1', label: 'No, I need a human' },
      ],
    },
  },

  {
    key: 'appointment',
    name: 'Appointment booking',
    category: 'Services',
    description: 'Collect the department, preferred slot and patient name, then confirm the booking.',
    accent: '#34d399',
    aiPersona:
      'You are a polite clinic receptionist. Never give medical advice; collect booking details and reassure the patient.',
    triggerKeywords: ['book', 'appointment', 'doctor'],
    graph: {
      nodes: [
        { id: 'start', type: 'start', position: at(0, 1), data: { label: 'Start', triggers: ['book', 'appointment'] } },
        {
          id: 'dept',
          type: 'question',
          position: at(1, 1),
          data: {
            label: 'Department',
            text: 'Hello! Which department would you like to book with?',
            responses: ['General medicine', 'Dentistry', 'Dermatology'],
            variable: 'department',
          },
        },
        {
          id: 'slot',
          type: 'question',
          position: at(2, 1),
          data: {
            label: 'Slot',
            text: '{{department}} it is. Which slot suits you best?',
            responses: ['Morning', 'Afternoon', 'Evening'],
            variable: 'slot',
          },
        },
        {
          id: 'patient',
          type: 'capture',
          position: at(3, 1),
          data: { label: 'Patient name', text: 'And the full name of the patient?', variable: 'patientName' },
        },
        {
          id: 'confirm',
          type: 'end',
          position: at(4, 1),
          data: {
            label: 'Confirmed',
            text: 'Booked ✅ {{patientName}} - {{department}}, {{slot}}. We will text a reminder the day before.',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'dept' },
        { id: 'e2', source: 'dept', target: 'slot', sourceHandle: 'response-0', label: 'General medicine' },
        { id: 'e3', source: 'dept', target: 'slot', sourceHandle: 'response-1', label: 'Dentistry' },
        { id: 'e4', source: 'dept', target: 'slot', sourceHandle: 'response-2', label: 'Dermatology' },
        { id: 'e5', source: 'slot', target: 'patient', sourceHandle: 'response-0', label: 'Morning' },
        { id: 'e6', source: 'slot', target: 'patient', sourceHandle: 'response-1', label: 'Afternoon' },
        { id: 'e7', source: 'slot', target: 'patient', sourceHandle: 'response-2', label: 'Evening' },
        { id: 'e8', source: 'patient', target: 'confirm' },
      ],
    },
  },

  {
    key: 'portfolio',
    name: 'Portfolio concierge',
    category: 'Personal',
    description: 'Share projects, a resume link and tech stack, then capture contact details.',
    accent: '#f472b6',
    aiPersona:
      'You represent an independent developer. Be confident but factual about experience, and steer serious enquiries toward a call.',
    triggerKeywords: ['hire', 'portfolio', 'work'],
    graph: {
      nodes: [
        { id: 'start', type: 'start', position: at(0, 1), data: { label: 'Start', triggers: ['hire', 'portfolio'] } },
        {
          id: 'intent',
          type: 'question',
          position: at(1, 1),
          data: {
            label: 'Intent',
            text: 'Hey! What brings you here today?',
            responses: ['See recent work', 'Discuss a project', 'Get the resume'],
            variable: 'intent',
          },
        },
        {
          id: 'work',
          type: 'message',
          position: at(2, 0),
          data: { label: 'Recent work', text: 'Here are three recent builds: a realtime CRM, a payments dashboard, and this chatbot platform.' },
        },
        {
          id: 'resume',
          type: 'end',
          position: at(2, 2),
          data: { label: 'Resume', text: 'Resume sent 📄 Let me know if you would like references too.' },
        },
        {
          id: 'brief',
          type: 'capture',
          position: at(3, 1),
          data: { label: 'Project brief', text: 'Tell me a little about the project - scope, timeline, anything useful.', variable: 'brief' },
        },
        {
          id: 'contact',
          type: 'capture',
          position: at(4, 1),
          data: { label: 'Contact', text: 'Sounds interesting. What is the best email to reach you on?', variable: 'email' },
        },
        {
          id: 'wrap',
          type: 'end',
          position: at(5, 1),
          data: { label: 'Wrap up', text: 'Thanks {{contactName}} - I will follow up at {{email}} within a day.' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'intent' },
        { id: 'e2', source: 'intent', target: 'work', sourceHandle: 'response-0', label: 'See recent work' },
        { id: 'e3', source: 'intent', target: 'brief', sourceHandle: 'response-1', label: 'Discuss a project' },
        { id: 'e4', source: 'intent', target: 'resume', sourceHandle: 'response-2', label: 'Get the resume' },
        { id: 'e5', source: 'work', target: 'brief' },
        { id: 'e6', source: 'brief', target: 'contact' },
        { id: 'e7', source: 'contact', target: 'wrap' },
      ],
    },
  },
];

export function templateByKey(key: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.key === key);
}

export function templateSummaries() {
  return FLOW_TEMPLATES.map(({ graph, ...rest }) => ({
    ...rest,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
  }));
}
