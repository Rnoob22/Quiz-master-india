import { LegalShell, Section } from "@/components/legal/LegalShell";

const RefundPage = () => {
  return (
    <LegalShell title="Refund Policy" updated="June 2025">
      <p>QuizMasters India operates skill-based quizzes with prize pools. Refund eligibility is limited to specific scenarios listed below.</p>

      <Section title="1. When You Are Entitled to a Refund">
        <ul className="list-disc space-y-1 pl-5">
          <li>A quiz is cancelled by QuizMasters India before it goes live.</li>
          <li>A technical platform failure prevents you from taking the quiz despite a successful payment.</li>
          <li>You were charged twice for the same quiz entry (duplicate transaction).</li>
        </ul>
      </Section>

      <Section title="2. When You Are NOT Entitled to a Refund">
        <ul className="list-disc space-y-1 pl-5">
          <li>You join a quiz and choose not to play.</li>
          <li>You leave the quiz mid-way or are disqualified for cheating.</li>
          <li>You did not win a prize.</li>
          <li>You lost your network connection on your end.</li>
        </ul>
      </Section>

      <Section title="3. How to Request a Refund">
        <p>Email refunds@quizmasters.example.in within 7 days of the transaction with the Razorpay order ID and reason. Approved refunds are processed back to the original payment method within 5–7 business days.</p>
      </Section>

      <Section title="4. GST on Refunds">
        <p>Where 18% GST was originally collected, the refund will include the GST component proportionally.</p>
      </Section>
    </LegalShell>
  );
};

export default RefundPage;
