import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { useChatStore } from '@/lib/chat-store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

// ─── Entitlement Status Bar ───────────────────────────────────────────────────

function EntitlementBar({
  daysRemaining,
  messagesRemaining,
  messageLimit,
  isActive,
  colors,
}: {
  daysRemaining: number;
  messagesRemaining: number;
  messageLimit: number;
  isActive: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const usedFraction = 1 - messagesRemaining / messageLimit;
  const barColor = usedFraction > 0.9 ? colors.error : usedFraction > 0.7 ? colors.warning : colors.success;

  return (
    <View style={[styles.entitlementBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.entitlementLeft}>
        <IconSymbol name="clock" size={13} color={colors.muted} />
        <Text style={[styles.entitlementText, { color: colors.muted }]}>
          {isActive ? `${daysRemaining}d remaining` : 'Expired'}
        </Text>
      </View>
      <View style={styles.entitlementRight}>
        <View style={[styles.msgBar, { backgroundColor: colors.border }]}>
          <View style={[styles.msgBarFill, { width: `${Math.min(100, usedFraction * 100)}%` as any, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.entitlementText, { color: colors.muted }]}>
          {messagesRemaining.toLocaleString()} msgs left
        </Text>
      </View>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, colors }: { message: Message; colors: ReturnType<typeof useColors> }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: '#1e3a5f' }]}>
          <Text style={styles.avatarEmoji}>⚓</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.primary }]
            : [styles.bubbleBot, { backgroundColor: colors.surface, borderColor: colors.border }],
        ]}
      >
        <Text style={[styles.bubbleText, { color: isUser ? '#FFFFFF' : colors.foreground }]}>
          {message.content}
        </Text>
        <Text style={[styles.bubbleTime, { color: isUser ? 'rgba(255,255,255,0.6)' : colors.muted }]}>
          {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
      <View style={[styles.avatar, { backgroundColor: '#1e3a5f' }]}>
        <Text style={styles.avatarEmoji}>⚓</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleBot, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.bubbleText, { color: colors.muted }]}>Captain Bob is typing…</Text>
      </View>
    </View>
  );
}

// ─── Expired State ────────────────────────────────────────────────────────────

function ExpiredState({
  colors,
  onExtend,
  isExtending,
}: {
  colors: ReturnType<typeof useColors>;
  onExtend: () => void;
  isExtending: boolean;
}) {
  return (
    <View style={styles.expiredContainer}>
      <View style={[styles.expiredIcon, { backgroundColor: colors.warning + '18' }]}>
        <Text style={{ fontSize: 48 }}>⚓</Text>
      </View>
      <Text style={[styles.expiredTitle, { color: colors.foreground }]}>
        Your Support Window Has Ended
      </Text>
      <Text style={[styles.expiredBody, { color: colors.muted }]}>
        Your 30-day Captain Bob live support has expired. Extend for another 30 days and 1,000 messages for just $9.99.
      </Text>
      <View style={[styles.extensionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.extensionRow}>
          <View>
            <Text style={[styles.extensionLabel, { color: colors.foreground }]}>30-Day Extension</Text>
            <Text style={[styles.extensionSub, { color: colors.muted }]}>1,000 messages · Captain Bob support</Text>
          </View>
          <Text style={[styles.extensionPrice, { color: colors.primary }]}>$9.99</Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.extendBtn,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.85 },
        ]}
        onPress={onExtend}
        disabled={isExtending}
      >
        {isExtending ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <IconSymbol name="arrow.clockwise" size={18} color="#FFFFFF" />
            <Text style={styles.extendBtnText}>Extend for $9.99</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ─── No Access State ─────────────────────────────────────────────────────────

function NoAccessState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.expiredContainer}>
      <Text style={{ fontSize: 56, textAlign: 'center' }}>⚓</Text>
      <Text style={[styles.expiredTitle, { color: colors.foreground }]}>
        Premium Feature
      </Text>
      <Text style={[styles.expiredBody, { color: colors.muted }]}>
        Captain Bob live support is included with the Premium Builder Package. Upgrade to get 30 days of expert chat support.
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CaptainBobScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const { orderId, chatToken } = useChatStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

  const hasCredentials = !!orderId && !!chatToken;

  // Fetch entitlement status
  const { data: entitlement, refetch: refetchEntitlement } = trpc.chat.getEntitlement.useQuery(
    { orderId: orderId ?? 0, chatToken: chatToken ?? '' },
    { enabled: hasCredentials, refetchInterval: 60_000 }
  );

  // Fetch chat history
  const { data: historyData } = trpc.chat.getHistory.useQuery(
    { orderId: orderId ?? 0, chatToken: chatToken ?? '' },
    { enabled: hasCredentials && !!entitlement?.isActive }
  );

  // Load history into local state
  useEffect(() => {
    if (historyData && historyData.length > 0 && messages.length === 0) {
      setMessages(
        historyData.map((m) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt),
        }))
      );
    }
  }, [historyData]);

  // Show welcome message if no history
  useEffect(() => {
    if (entitlement?.isActive && messages.length === 0 && historyData?.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            "Ahoy! I'm Captain Bob, your expert cardboard boat building guide! ⚓\n\nI'm here to help you build a winning boat. Ask me anything about construction techniques, materials, waterproofing, race strategy, or anything else about your build. What would you like to know?",
          createdAt: new Date(),
        },
      ]);
    }
  }, [entitlement?.isActive, historyData]);

  const sendMessage = trpc.chat.sendMessage.useMutation();
  const createExtensionIntent = trpc.chat.createExtensionIntent.useMutation();
  const confirmExtension = trpc.chat.confirmExtension.useMutation();

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || !orderId || !chatToken) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const result = await sendMessage.mutateAsync({
        orderId,
        chatToken,
        message: text,
      });

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
      await refetchEntitlement();

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (msg.startsWith('EXPIRED:') || msg.startsWith('LIMIT_REACHED:')) {
        await refetchEntitlement();
      } else {
        Alert.alert('Error', 'Could not send message. Please try again.');
        // Remove the optimistic user message
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      }
    } finally {
      setIsSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [inputText, isSending, orderId, chatToken]);

  const handleExtend = useCallback(async () => {
    if (!orderId || !chatToken || !entitlement) return;
    setIsExtending(true);
    try {
      // In demo mode (no Stripe), confirm directly
      const intentResult = await createExtensionIntent.mutateAsync({
        orderId,
        chatToken,
        email: 'customer@example.com',
      });

      await confirmExtension.mutateAsync({
        orderId,
        chatToken,
        stripePaymentIntentId: intentResult.stripePaymentIntentId ?? undefined,
      });

      await refetchEntitlement();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        'Extended! ⚓',
        'Your Captain Bob support has been extended by 30 days. Welcome back aboard!'
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Could not process extension. Please try again.');
    } finally {
      setIsExtending(false);
    }
  }, [orderId, chatToken, entitlement]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!hasCredentials) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerEmoji]}>⚓</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Captain Bob</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>Premium Support</Text>
        </View>
        <NoAccessState colors={colors} />
      </View>
    );
  }

  const isExpired = entitlement && !entitlement.isActive;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom + 8}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Text style={styles.headerEmoji}>⚓</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Captain Bob</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>Expert Boat Building Support</Text>
        </View>
        <View style={[styles.onlineBadge, { backgroundColor: entitlement?.isActive ? colors.success + '18' : colors.error + '18' }]}>
          <View style={[styles.onlineDot, { backgroundColor: entitlement?.isActive ? colors.success : colors.error }]} />
          <Text style={[styles.onlineText, { color: entitlement?.isActive ? colors.success : colors.error }]}>
            {entitlement?.isActive ? 'Online' : 'Expired'}
          </Text>
        </View>
      </View>

      {/* Entitlement status bar */}
      {entitlement && (
        <EntitlementBar
          daysRemaining={entitlement.daysRemaining}
          messagesRemaining={entitlement.messagesRemaining}
          messageLimit={entitlement.messageLimit}
          isActive={entitlement.isActive}
          colors={colors}
        />
      )}

      {/* Expired state */}
      {isExpired ? (
        <ExpiredState colors={colors} onExtend={handleExtend} isExtending={isExtending} />
      ) : (
        <>
          {/* Message list */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} colors={colors} />}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={isSending ? <TypingIndicator colors={colors} /> : null}
          />

          {/* Input bar */}
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: insets.bottom + 8,
              },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="Ask Captain Bob anything…"
              placeholderTextColor={colors.muted + '88'}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: inputText.trim() ? colors.primary : colors.border },
                pressed && inputText.trim() && { opacity: 0.8 },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
            >
              <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 16,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  headerEmoji: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  headerSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  entitlementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  entitlementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  entitlementRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entitlementText: {
    fontSize: 11,
    fontWeight: '500',
  },
  msgBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  msgBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  messageList: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowBot: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarEmoji: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Expired / No Access states
  expiredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  expiredIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
  },
  expiredBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  extensionCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  extensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extensionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  extensionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  extensionPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  extendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
  },
  extendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
