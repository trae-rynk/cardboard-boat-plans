import { ScrollView, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

export default function NoRefundsPolicyScreen() {
  const router = useRouter();
  const colors = useColors();

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Sales Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text style={[styles.title, { color: colors.foreground }]}>
          No Refund Policy
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Champion Cardboard Boats — championcardboardboats.com
        </Text>
        <Text style={[styles.updated, { color: colors.muted }]}>
          Effective Date: March 2026
        </Text>

        {/* Policy sections */}
        <Section
          title="All Sales Are Final"
          colors={colors}
          body="All purchases made through the Champion Cardboard Boats app are final and non-refundable. By completing a purchase, you acknowledge and agree that no refunds, exchanges, or credits will be issued under any circumstances."
        />

        <Section
          title="Digital Download Products"
          colors={colors}
          body="Our products are delivered as instant digital downloads. Because the content is made immediately available to you upon purchase confirmation, we are unable to accept returns or process refunds once the transaction is complete. This applies to all products, including the Builder Plan Package and the Premium Builder Package."
        />

        <Section
          title="Premium Builder Package — Live Support"
          colors={colors}
          body="The Premium Builder Package includes 30 days of live chat support with Captain Bob, beginning from the date of purchase. This support window is non-transferable and cannot be paused, extended without additional purchase, or refunded if unused. Access to the chat support feature is tied to the original purchase and is non-refundable."
        />

        <Section
          title="Why We Have This Policy"
          colors={colors}
          body="Because our products are digital in nature, they cannot be 'returned' in the traditional sense. Once the plans are downloaded or accessed, the content has been delivered in full. This policy protects the integrity of our products and ensures fair pricing for all customers."
        />

        <Section
          title="Exceptions"
          colors={colors}
          body="We do not make exceptions to this policy. We strongly encourage you to review the product descriptions, included features, and any available preview content before completing your purchase. If you have questions about a product before buying, please contact us at support@championcardboardboats.com."
        />

        <Section
          title="Chargebacks & Disputes"
          colors={colors}
          body="Filing a chargeback or payment dispute after receiving access to digital content is considered fraudulent misuse of the dispute process. We reserve the right to contest all chargebacks and provide transaction records, delivery confirmation, and this policy to the payment processor as evidence."
        />

        <Section
          title="Contact Us"
          colors={colors}
          body="If you have a question about your order or are experiencing a technical issue accessing your purchased content, please reach out before initiating any dispute. We are happy to help resolve genuine technical problems."
        />

        <View style={[styles.contactBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
          By completing a purchase in this app, you confirm that you have read, understood, and agreed to this No Refund Policy.
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
