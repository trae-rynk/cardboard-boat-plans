import { ScrollView, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const colors = useColors();

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.foreground }]}>Privacy Policy</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Champion Cardboard Boats — championcardboardboats.com
        </Text>
        <Text style={[styles.updated, { color: colors.muted }]}>
          Effective Date: March 2026
        </Text>

        <Section
          title="Overview"
          colors={colors}
          body="Champion Cardboard Boats (we, us, or our) is committed to protecting your privacy. This Privacy Policy explains what information we collect when you use our mobile app, how we use it, and your rights regarding that information. By using this app, you agree to the practices described in this policy."
        />

        <Section
          title="Information We Collect"
          colors={colors}
          body="When you make a purchase, we collect your name, email address, and payment information. Payment details (card number, expiry, CVC) are processed directly by Stripe and are never stored on our servers. We only receive a confirmation token from Stripe indicating whether the payment was successful. We also collect your email address for the purpose of delivering your purchased content and sending order-related communications."
        />

        <Section
          title="How We Use Your Information"
          colors={colors}
          body="We use your information to fulfill your order and deliver your digital download, send you a purchase confirmation and download access details, send a follow-up email approximately 5 days after purchase inviting you to leave a review (you may opt out by not responding), and provide live chat support through Captain Bob if you purchased the Premium Builder Package. We do not sell, rent, or share your personal information with third parties for marketing purposes."
        />

        <Section
          title="Payment Processing"
          colors={colors}
          body="All payments are processed by Stripe, Inc. Stripe is a PCI-DSS compliant payment processor. We do not store your full card number, CVV, or other sensitive payment details. By making a purchase, you also agree to Stripe's Privacy Policy, available at stripe.com/privacy."
        />

        <Section
          title="Email Communications"
          colors={colors}
          body="We will send you transactional emails related to your purchase, including order confirmation and your digital download link. Approximately 5 days after purchase, we may send a single follow-up email inviting you to share a review. We do not send unsolicited marketing emails. If you wish to stop receiving emails from us, you may contact us at the address below."
        />

        <Section
          title="Data Retention"
          colors={colors}
          body="We retain your order information (name, email, product purchased, and purchase date) for as long as necessary to fulfill our legal and business obligations, including resolving disputes and complying with applicable laws. You may request deletion of your personal data at any time by contacting us."
        />

        <Section
          title="Children's Privacy"
          colors={colors}
          body="This app is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately and we will take steps to delete it."
        />

        <Section
          title="Security"
          colors={colors}
          body="We take reasonable technical and organizational measures to protect your personal information from unauthorized access, loss, or misuse. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security."
        />

        <Section
          title="Third-Party Services"
          colors={colors}
          body="We use the following third-party services that may process your data as part of our operations: Stripe (payment processing), Resend (transactional email delivery), and OpenAI (AI-powered chat support for Premium customers). Each of these services has its own privacy policy governing how they handle data."
        />

        <Section
          title="Your Rights"
          colors={colors}
          body="You have the right to request access to the personal information we hold about you, request correction of inaccurate information, request deletion of your personal data, and opt out of non-transactional email communications. To exercise any of these rights, please contact us using the information below."
        />

        <Section
          title="Changes to This Policy"
          colors={colors}
          body="We may update this Privacy Policy from time to time. When we do, we will update the Effective Date at the top of this page. Continued use of the app after any changes constitutes your acceptance of the updated policy."
        />

        <View style={[styles.contactBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.contactHeader, { color: colors.foreground }]}>Contact Us</Text>
          <Text style={[styles.contactBody, { color: colors.muted }]}>
            For any privacy-related questions or requests:
          </Text>
          <Text style={[styles.contactLabel, { color: colors.muted }]}>Email</Text>
          <Text style={[styles.contactValue, { color: colors.primary }]}>
            support@championcardboardboats.com
          </Text>
          <Text style={[styles.contactLabel, { color: colors.muted }]}>Website</Text>
          <Text style={[styles.contactValue, { color: colors.primary }]}>
            championcardboardboats.com
          </Text>
        </View>

        <Text style={[styles.footer, { color: colors.muted }]}>
          By using this app and making a purchase, you acknowledge that you have read and understood this Privacy Policy.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({
  title,
  body,
  colors,
}: {
  title: string;
  body: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.sectionBody, { color: colors.foreground }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  updated: {
    fontSize: 13,
    marginBottom: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 23,
  },
  contactBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 4,
  },
  contactHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  contactBody: {
    fontSize: 14,
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  footer: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontStyle: "italic",
    paddingTop: 8,
  },
});
