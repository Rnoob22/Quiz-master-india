import { LegalShell, Section } from "@/components/legal/LegalShell";

const TermsPage = () => {
  return (
    <LegalShell title="Terms of Service" updated="June 2025">
      <p>Welcome to QuizMasters India. By accessing or using our platform you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our services.</p>

      <Section title="1. Eligibility">
        <p>You must be at least 18 years of age and a resident of India to participate in paid quizzes and receive cash prizes. Participation may be restricted in states where skill-based gaming is prohibited.</p>
      </Section>

      <Section title="2. Account Registration">
        <p>Accounts are created via Google OAuth. You are responsible for maintaining the confidentiality of your Google credentials and for all activities under your account. One account is permitted per person and per device.</p>
      </Section>

      <Section title="3. Quizzes & Prizes">
        <p>QuizMasters India operates as a skill-based competition. Outcomes are determined by knowledge, accuracy and response time. Prize pools are set by the platform and are visible before entry. Prizes are distributed using the published 4-tier ranking algorithm (score, time, accuracy, submission order).</p>
      </Section>

      <Section title="4. Fair Play & Anti-Cheating">
        <p>You agree not to use any unauthorised tools, scripts, multiple devices, or attempt to evade our full-screen, focus-tracking and copy-prevention safeguards. Detected cheating results in immediate score forfeiture and account suspension.</p>
      </Section>

      <Section title="5. Payments">
        <p>Entry fees are processed via Razorpay. Where the quiz collects GST, an additional 18% is added to the entry fee. All amounts are charged in Indian Rupees (INR).</p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>All content, branding, questions, and software belong to QuizMasters India. You may not copy, redistribute or republish any material without prior written consent.</p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>QuizMasters India is not liable for indirect or consequential losses arising out of platform downtime, network failure, or third-party payment gateway issues.</p>
      </Section>

      <Section title="8. Contact">
        <p>For queries write to support@quizmasters.example.in.</p>
      </Section>
    </LegalShell>
  );
};

export default TermsPage;
