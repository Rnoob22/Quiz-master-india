import { LegalShell, Section } from "@/components/legal/LegalShell";

const PrivacyPage = () => {
  return (
    <LegalShell title="Privacy Policy" updated="June 2025">
      <p>Your privacy matters. This policy explains what information we collect and how we use it.</p>

      <Section title="1. Data We Collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Identity data from Google: name, email, profile photo.</li>
          <li>Profile data you provide: date of birth, state, city, preferred language.</li>
          <li>Gameplay data: quiz submissions, scores, response times, ranks.</li>
          <li>Payment data: Razorpay order IDs and amounts (we never store your card or UPI credentials).</li>
          <li>Technical data: device fingerprint, browser session metadata for anti-cheating only.</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Data">
        <p>To operate quizzes, compute rankings, distribute prizes, prevent fraud and cheating, send transactional emails, comply with GST and audit obligations, and improve the product.</p>
      </Section>

      <Section title="3. Data Sharing">
        <p>We share minimum necessary data with Razorpay for payment processing. We never sell personal data to advertisers.</p>
      </Section>

      <Section title="4. Data Retention">
        <p>Account, payment and submission records are retained for 7 years to comply with Indian tax and audit regulations.</p>
      </Section>

      <Section title="5. Your Rights">
        <p>You may request access, correction, or deletion of your personal data by writing to privacy@quizmasters.example.in. Some data may be retained where required by law.</p>
      </Section>

      <Section title="6. Security">
        <p>We use HTTPS, encrypted database connections (Neon TLS), HMAC-SHA256 payment signature validation, and constant-time crypto comparisons to protect your data.</p>
      </Section>
    </LegalShell>
  );
};

export default PrivacyPage;
