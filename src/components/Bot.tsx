import { createSignal, createEffect, For, onMount, Show, mergeProps, on, createMemo } from 'solid-js';
import { v4 as uuidv4 } from 'uuid';
import {
  sendMessageQuery,
  upsertVectorStoreWithFormData,
  isStreamAvailableQuery,
  IncomingInput,
  getChatbotConfig,
  FeedbackRatingType,
} from '@/queries/sendMessageQuery';
import { TextInput } from './inputs/textInput';
import { GuestBubble } from './bubbles/GuestBubble';
import { BotBubble } from './bubbles/BotBubble';
import { LoadingBubble } from './bubbles/LoadingBubble';
import { StarterPromptBubble } from './bubbles/StarterPromptBubble';
import {
  BotMessageTheme,
  FooterTheme,
  TextInputTheme,
  UserMessageTheme,
  FeedbackTheme,
  DisclaimerPopUpTheme,
  DateTimeToggleTheme,
} from '@/features/bubble/types';
import { Badge } from './Badge';
import { Popup, DisclaimerPopup } from '@/features/popup';
import { Avatar } from '@/components/avatars/Avatar';
import { DeleteButton, SendButton } from '@/components/buttons/SendButton';
import { FilePreview } from '@/components/inputs/textInput/components/FilePreview';
import { CircleDotIcon, SparklesIcon, TrashIcon } from './icons';
import { CancelButton } from './buttons/CancelButton';
import { cancelAudioRecording, startAudioRecording, stopAudioRecording } from '@/utils/audioRecording';
import { LeadCaptureBubble } from '@/components/bubbles/LeadCaptureBubble';
import { removeLocalStorageChatHistory, getLocalStorageChatflow, setLocalStorageChatflow, setCookie, getCookie } from '@/utils';
import { cloneDeep } from 'lodash';
import { FollowUpPromptBubble } from '@/components/bubbles/FollowUpPromptBubble';
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';

export type FileEvent<T = EventTarget> = {
  target: T;
};

export type FormEvent<T = EventTarget> = {
  preventDefault: () => void;
  currentTarget: T;
};

type IUploadConstraits = {
  fileTypes: string[];
  maxUploadSize: number;
};

export type UploadsConfig = {
  imgUploadSizeAndTypes: IUploadConstraits[];
  fileUploadSizeAndTypes: IUploadConstraits[];
  isImageUploadAllowed: boolean;
  isSpeechToTextEnabled: boolean;
  isFileUploadAllowed: boolean;
};

type FilePreviewData = string | ArrayBuffer;

type FilePreview = {
  data: FilePreviewData;
  mime: string;
  name: string;
  preview: string;
  type: string;
};

type messageType = 'apiMessage' | 'userMessage' | 'usermessagewaiting' | 'leadCaptureMessage';

export type IAgentReasoning = {
  agentName?: string;
  messages?: string[];
  usedTools?: any[];
  artifacts?: FileUpload[];
  sourceDocuments?: any[];
  instructions?: string;
  nextAgent?: string;
};

export type IAction = {
  id?: string;
  elements?: Array<{
    type: string;
    label: string;
  }>;
  mapping?: {
    approve: string;
    reject: string;
    toolCalls: any[];
  };
};

export type FileUpload = Omit<FilePreview, 'preview'>;

export type MessageType = {
  messageId?: string;
  message: string;
  type: messageType;
  sourceDocuments?: any;
  fileAnnotations?: any;
  fileUploads?: Partial<FileUpload>[];
  artifacts?: Partial<FileUpload>[];
  agentReasoning?: IAgentReasoning[];
  usedTools?: any[];
  action?: IAction | null;
  rating?: FeedbackRatingType;
  id?: string;
  followUpPrompts?: string;
  dateTime?: string;
};

type observerConfigType = (accessor: string | boolean | object | MessageType[]) => void;
export type observersConfigType = Record<'observeUserInput' | 'observeLoading' | 'observeMessages', observerConfigType>;

export type BotProps = {
  chatflowid: string;
  apiHost?: string;
  onRequest?: (request: RequestInit) => Promise<void>;
  chatflowConfig?: Record<string, unknown>;
  welcomeMessage?: string;
  errorMessage?: string;
  botMessage?: BotMessageTheme;
  userMessage?: UserMessageTheme;
  textInput?: TextInputTheme;
  feedback?: FeedbackTheme;
  poweredByTextColor?: string;
  badgeBackgroundColor?: string;
  bubbleBackgroundColor?: string;
  bubbleTextColor?: string;
  showTitle?: boolean;
  showAgentMessages?: boolean;
  title?: string;
  titleAvatarSrc?: string;
  fontSize?: number;
  isFullPage?: boolean;
  footer?: FooterTheme;
  sourceDocsTitle?: string;
  observersConfig?: observersConfigType;
  starterPrompts?: string[] | Record<string, { prompt: string }>;
  starterPromptFontSize?: number;
  clearChatOnReload?: boolean;
  disclaimer?: DisclaimerPopUpTheme;
  dateTimeToggle?: DateTimeToggleTheme;
  renderHTML?: boolean;
};

export type LeadsConfig = {
  status: boolean;
  title?: string;
  name?: boolean;
  email?: boolean;
  phone?: boolean;
  successMessage?: string;
};

const defaultWelcomeMessage = 'Hi there! How can I help?';

/*const sourceDocuments = [
    {
        "pageContent": "Bazıları “COVID-19 ile yaşamak” hakkında konuşuyor. Bu gece – COVID-19 ile yaşamayı asla kabul etmeyeceğimizi söylüyorum. \r\n\r\nVirüsle diğer hastalıklarla olduğu gibi mücadele etmeye devam edeceğiz. Ve bu, mutasyona uğrayan ve yayılan bir virüs olduğu için, tetikte kalacağız. \r\n\r\nİşte güvenli bir şekilde ilerlerken dört sağduyulu adım.  \r\n\r\nİlk olarak, aşılar ve tedavilerle koruma altında kalın. Aşıların ne kadar inanılmaz derecede etkili olduğunu biliyoruz. Aşılı ve güçlendirilmişseniz en yüksek koruma derecesine sahipsiniz. \r\n\r\nDaha fazla Amerikalıyı aşılamaktan asla vazgeçmeyeceğiz. Şimdi, 5 yaş altı çocukları olan ebeveynlerin çocukları için bir aşının yetkilendirilmesini görmek için sabırsızlandıklarını biliyorum. \r\n\r\nBilim insanları bunu başarmak için çok çalışıyorlar ve yaptıklarında bol miktarda aşı ile hazır olacağız. \r\n\r\nAyrıca antiviral tedavilere de hazırız. COVID-19'a yakalanırsanız, Pfizer hapı hastaneye yatma şansınızı %90 oranında azaltır.",
        "metadata": {
          "source": "blob",
          "blobType": "",
          "loc": {
            "lines": {
              "from": 450,
              "to": 462
            }
          }
        }
    },
    {
        "pageContent": "sistance,  and  polishing  [65].  Örneğin, AI araçları anahtar kelimeler veya konular girilerek öneriler oluşturur. Araçlar, arama verilerini, trend konuları ve popüler sorguları analiz ederek yeni içerik oluşturur. Dahası, AIGC belirli konularda makale yazma ve blog gönderme konusunda yardımcı olur. Bu araçlar kendi başlarına yüksek kaliteli içerik üretemeyebilirken, yazar tıkanıklığı yaşayan bir yazar için bir başlangıç noktası sağlayabilirler.\nH.  AIGC'nin Eksileri\nHalk arasında en büyük endişelerden biri, AIGC'de potansiyel yaratıcılık eksikliği ve insan dokunuşudur. Ayrıca, AIGC bazen dil ve bağlamı anlamada ince bir anlayıştan yoksundur, bu da yanlışlıklara ve yanlış yorumlara yol açabilir. AIGC kullanımıyla ilgili etik ve yasal konular da vardır, özellikle telif hakkı ihlali ve veri gizliliği gibi sorunlara yol açtığında. Bu bölümde, AIGC'nin bazı dezavantajlarını tartışacağız (Tablo IV).",
        "metadata": {
          "source": "blob",
          "blobType": "",
          "pdf": {
            "version": "1.10.100",
            "info": {
              "PDFFormatVersion": "1.5",
              "IsAcroFormPresent": false,
              "IsXFAPresent": false,
              "Title": "",
              "Author": "",
              "Subject": "",
              "Keywords": "",
              "Creator": "LaTeX with hyperref",
              "Producer": "pdfTeX-1.40.21",
              "CreationDate": "D:20230414003603Z",
              "ModDate": "D:20230414003603Z",
              "Trapped": {
                "name": "False"
              }
            },
            "metadata": null,
            "totalPages": 17
          },
          "loc": {
            "pageNumber": 8,
            "lines": {
              "from": 301,
              "to": 317
            }
          }
        }
    },
    {
        "pageContent": "Ana makale: Elon Musk'un Görüşleri",
        "metadata": {
          "source": "https://en.wikipedia.org/wiki/Elon_Musk",
          "loc": {
            "lines": {
              "from": 2409,
              "to": 2409
            }
          }
        }
    },
    {
        "pageContent": "Ad: John\nSoyad: Doe\nAdres: 120 jefferson st.\nEyalet: Riverside\nKod: NJ\nPosta: 8075",
        "metadata": {
          "source": "blob",
          "blobType": "",
          "line": 1,
          "loc": {
            "lines": {
              "from": 1,
              "to": 6
            }
          }
        }
    },
]*/

const defaultBackgroundColor = '#ffffff';
const defaultTextColor = '#303235';

export const Bot = (botProps: BotProps & { class?: string }) => {
  // showTitle için varsayılan bir değer ayarlayın ve diğer özelliklerle birleştirin
  const props = mergeProps({ showTitle: true }, botProps);
  let chatContainer: HTMLDivElement | undefined;
  let bottomSpacer: HTMLDivElement | undefined;
  let botContainer: HTMLDivElement | undefined;

  const [userInput, setUserInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [sourcePopupOpen, setSourcePopupOpen] = createSignal(false);
  const [sourcePopupSrc, setSourcePopupSrc] = createSignal({});
  const [messages, setMessages] = createSignal<MessageType[]>(
    [
      {
        message: props.welcomeMessage ?? defaultWelcomeMessage,
        type: 'apiMessage',
      },
    ],
    { equals: false },
  );

  const [isChatFlowAvailableToStream, setIsChatFlowAvailableToStream] = createSignal(false);
  const [chatId, setChatId] = createSignal(
    (props.chatflowConfig?.vars as any)?.customerId ? `${(props.chatflowConfig?.vars as any).customerId.toString()}+${uuidv4()}` : uuidv4(),
  );
  const [isMessageStopping, setIsMessageStopping] = createSignal(false);
  const [starterPrompts, setStarterPrompts] = createSignal<string[]>([], { equals: false });
  const [chatFeedbackStatus, setChatFeedbackStatus] = createSignal<boolean>(false);
  const [uploadsConfig, setUploadsConfig] = createSignal<UploadsConfig>();
  const [leadsConfig, setLeadsConfig] = createSignal<LeadsConfig>();
  const [isLeadSaved, setIsLeadSaved] = createSignal(false);
  const [leadEmail, setLeadEmail] = createSignal('');
  const [disclaimerPopupOpen, setDisclaimerPopupOpen] = createSignal(false);

  // sürükle & bırak dosya girişi
  // TODO: bu türü düzelt
  const [previews, setPreviews] = createSignal<FilePreview[]>([]);

  // ses kaydı
  const [elapsedTime, setElapsedTime] = createSignal('00:00');
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordingNotSupported, setRecordingNotSupported] = createSignal(false);
  const [isLoadingRecording, setIsLoadingRecording] = createSignal(false);

  // takip istemleri
  const [followUpPromptsStatus, setFollowUpPromptsStatus] = createSignal<boolean>(false);
  const [followUpPrompts, setFollowUpPrompts] = createSignal<string[]>([]);

  // sürükle & bırak
  const [isDragActive, setIsDragActive] = createSignal(false);
  const [uploadedFiles, setUploadedFiles] = createSignal<File[]>([]);

  onMount(() => {
    if (botProps?.observersConfig) {
      const { observeUserInput, observeLoading, observeMessages } = botProps.observersConfig;
      typeof observeUserInput === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeUserInput(userInput());
        });
      typeof observeLoading === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeLoading(loading());
        });
      typeof observeMessages === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeMessages(messages());
        });
    }

    if (!bottomSpacer) return;
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  });

  const scrollToBottom = () => {
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  };

  /**
   * Her sohbet mesajını localStorage'a ekleyin
   */
  const addChatMessage = (allMessage: MessageType[]) => {
    const messages = allMessage.map((item) => {
      if (item.fileUploads) {
        const fileUploads = item?.fileUploads.map((file) => ({
          type: file.type,
          name: file.name,
          mime: file.mime,
        }));
        return { ...item, fileUploads };
      }
      return item;
    });
    setLocalStorageChatflow(props.chatflowid, chatId(), { chatHistory: messages });
  };

  // audioRef tanımlayın
  let audioRef: HTMLAudioElement | undefined;
  // varsayılan alıcı ses için CDN bağlantısı
  const defaultReceiveSound = 'https://cdn.jsdelivr.net/gh/FlowiseAI/FlowiseChatEmbed@latest/src/assets/receive_message.mp3';
  const playReceiveSound = () => {
    if (props.textInput?.receiveMessageSound) {
      let audioSrc = defaultReceiveSound;
      if (props.textInput?.receiveSoundLocation) {
        audioSrc = props.textInput?.receiveSoundLocation;
      }
      audioRef = new Audio(audioSrc);
      audioRef.play();
    }
  };

  let hasSoundPlayed = false;

  const updateLastMessage = (text: string) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      if (!text) return allMessages;
      allMessages[allMessages.length - 1].message += text;
      allMessages[allMessages.length - 1].rating = undefined;
      allMessages[allMessages.length - 1].dateTime = new Date().toISOString();
      if (!hasSoundPlayed) {
        playReceiveSound();
        hasSoundPlayed = true;
      }
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateErrorMessage = (errorMessage: string) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      allMessages.push({ message: props.errorMessage || errorMessage, type: 'apiMessage' });
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageSourceDocuments = (sourceDocuments: any) => {
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, sourceDocuments };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
  };

  const updateLastMessageUsedTools = (usedTools: any[]) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      allMessages[allMessages.length - 1].usedTools = usedTools;
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageFileAnnotations = (fileAnnotations: any) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      allMessages[allMessages.length - 1].fileAnnotations = fileAnnotations;
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageAgentReasoning = (agentReasoning: string | IAgentReasoning[]) => {
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, agentReasoning: typeof agentReasoning === 'string' ? JSON.parse(agentReasoning) : agentReasoning };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
  };

  const updateLastMessageArtifacts = (artifacts: FileUpload[]) => {
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      allMessages[allMessages.length - 1].artifacts = artifacts;
      addChatMessage(allMessages);
      return allMessages;
    });
  };

  const updateLastMessageAction = (action: IAction) => {
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, action: typeof action === 'string' ? JSON.parse(action) : action };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
  };

  const clearPreviews = () => {
    // Bellek sızıntılarını önlemek için veri urilerini iptal edin
    previews().forEach((file) => URL.revokeObjectURL(file.preview));
    setPreviews([]);
  };

  // Hataları ele alın
  const handleError = (message = 'Oops! Bir hata var gibi görünüyor. Lütfen tekrar deneyin.') => {
    setMessages((prevMessages) => {
      const messages: MessageType[] = [...prevMessages, { message: props.errorMessage || message, type: 'apiMessage' }];
      addChatMessage(messages);
      return messages;
    });
    setLoading(false);
    setUserInput('');
    setUploadedFiles([]);
    scrollToBottom();
  };

  const handleDisclaimerAccept = () => {
    setDisclaimerPopupOpen(false); // Sorumluluk reddi açılır penceresini kapat
    setCookie('chatbotDisclaimer', 'true', 365); // Sorumluluk reddi kabul edildi
  };

  const promptClick = (prompt: string) => {
    handleSubmit(prompt);
  };

  const followUpPromptClick = (prompt: string) => {
    setFollowUpPrompts([]);
    handleSubmit(prompt);
  };

  const updateMetadata = (data: any, input: string) => {
    if (data.chatId) {
      setChatId(data.chatId);
    }

    // geri bildirim için gereken mesaj kimliğini ayarlayın
    if (data.chatMessageId) {
      setMessages((prevMessages) => {
        const allMessages = [...cloneDeep(prevMessages)];
        if (allMessages[allMessages.length - 1].type === 'apiMessage') {
          allMessages[allMessages.length - 1].messageId = data.chatMessageId;
        }
        addChatMessage(allMessages);
        return allMessages;
      });
    }

    if (input === '' && data.question) {
      // yanıt ses formatında olsa bile soruyu içerir
      // bu yüzden giriş boşsa ama yanıt soruyu içeriyorsa, kullanıcı mesajını soruyu gösterecek şekilde güncelleyin
      setMessages((prevMessages) => {
        const allMessages = [...cloneDeep(prevMessages)];
        if (allMessages[allMessages.length - 2].type === 'apiMessage') return allMessages;
        allMessages[allMessages.length - 2].message = data.question;
        addChatMessage(allMessages);
        return allMessages;
      });
    }

    if (data.followUpPrompts) {
      setMessages((prevMessages) => {
        const allMessages = [...cloneDeep(prevMessages)];
        if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
        allMessages[allMessages.length - 1].followUpPrompts = data.followUpPrompts;
        addChatMessage(allMessages);
        return allMessages;
      });
      setFollowUpPrompts(JSON.parse(data.followUpPrompts));
    }
  };

  const fetchResponseFromEventStream = async (chatflowid: string, params: any) => {
    const chatId = params.chatId;
    const input = params.question;
    params.streaming = true;
    fetchEventSource(`${props.apiHost}/api/v1/prediction/${chatflowid}`, {
      openWhenHidden: true,
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
      },
      async onopen(response) {
        if (response.ok && response.headers.get('content-type') === EventStreamContentType) {
          return; // her şey yolunda
        } else if (response.status === 429) {
          const errMessage = (await response.text()) ?? 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.';
          handleError(errMessage);
          throw new Error(errMessage);
        } else if (response.status === 403) {
          const errMessage = (await response.text()) ?? 'Yetkisiz';
          handleError(errMessage);
          throw new Error(errMessage);
        } else if (response.status === 401) {
          const errMessage = (await response.text()) ?? 'Kimlik doğrulaması yapılmadı';
          handleError(errMessage);
          throw new Error(errMessage);
        } else {
          throw new Error();
        }
      },
      async onmessage(ev) {
        const payload = JSON.parse(ev.data);
        switch (payload.event) {
          case 'start':
            setMessages((prevMessages) => [...prevMessages, { message: '', type: 'apiMessage' }]);
            break;
          case 'token':
            updateLastMessage(payload.data);
            break;
          case 'sourceDocuments':
            updateLastMessageSourceDocuments(payload.data);
            break;
          case 'usedTools':
            updateLastMessageUsedTools(payload.data);
            break;
          case 'fileAnnotations':
            updateLastMessageFileAnnotations(payload.data);
            break;
          case 'agentReasoning':
            updateLastMessageAgentReasoning(payload.data);
            break;
          case 'action':
            updateLastMessageAction(payload.data);
            break;
          case 'artifacts':
            updateLastMessageArtifacts(payload.data);
            break;
          case 'metadata':
            updateMetadata(payload.data, input);
            break;
          case 'error':
            updateErrorMessage(payload.data);
            break;
          case 'abort':
            abortMessage();
            closeResponse();
            break;
          case 'end':
            setLocalStorageChatflow(chatflowid, chatId);
            closeResponse();
            break;
        }
      },
      async onclose() {
        closeResponse();
      },
      onerror(err) {
        console.error('EventSource Hatası: ', err);
        closeResponse();
        throw err;
      },
    });
  };

  const closeResponse = () => {
    setLoading(false);
    setUserInput('');
    setUploadedFiles([]);
    hasSoundPlayed = false;
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  const abortMessage = () => {
    setIsMessageStopping(false);
    setMessages((prevMessages) => {
      const allMessages = [...cloneDeep(prevMessages)];
      if (allMessages[allMessages.length - 1].type === 'userMessage') return allMessages;
      const lastAgentReasoning = allMessages[allMessages.length - 1].agentReasoning;
      if (lastAgentReasoning && lastAgentReasoning.length > 0) {
        allMessages[allMessages.length - 1].agentReasoning = lastAgentReasoning.filter((reasoning) => !reasoning.nextAgent);
      }
      return allMessages;
    });
  };

  // Form gönderimini ele alın
  const handleSubmit = async (value: string, action?: IAction | undefined | null) => {
    if (value.trim() === '') {
      const containsFile = previews().filter((item) => !item.mime.startsWith('image') && item.type !== 'audio').length > 0;
      if (!previews().length || (previews().length && containsFile)) {
        return;
      }
    }

    setLoading(true);
    scrollToBottom();

    const uploads = previews().map((item) => {
      return {
        data: item.data,
        type: item.type,
        name: item.name,
        mime: item.mime,
      };
    });

    clearPreviews();

    setMessages((prevMessages) => {
      const messages: MessageType[] = [...prevMessages, { message: value, type: 'userMessage', fileUploads: uploads }];
      addChatMessage(messages);
      return messages;
    });

    const body: IncomingInput = {
      question: value,
      chatId: chatId(),
    };

    if (uploads && uploads.length > 0) body.uploads = uploads;

    if (props.chatflowConfig) body.overrideConfig = props.chatflowConfig;

    if (leadEmail()) body.leadEmail = leadEmail();

    if (action) body.action = action;

    if (uploadedFiles().length > 0) {
      const formData = new FormData();
      for (const file of uploadedFiles()) {
        formData.append('files', file);
      }
      formData.append('chatId', chatId());

      const response = await upsertVectorStoreWithFormData({
        chatflowid: props.chatflowid,
        apiHost: props.apiHost,
        formData: formData,
      });
      if (!response.data) {
        setMessages((prevMessages) => [...prevMessages, { message: 'Belgeler yüklenemiyor', type: 'apiMessage' }]);
      } else {
        // vektör deposunun güncellenmesi için gecikme
        const delay = (delayInms: number) => {
          return new Promise((resolve) => setTimeout(resolve, delayInms));
        };
        await delay(2500); //TODO: gömülerin dosya adı kullanılarak meta veri filtresi ile alınıp alınamayacağını kontrol edin
      }
    }

    if (isChatFlowAvailableToStream()) {
      fetchResponseFromEventStream(props.chatflowid, body);
    } else {
      const result = await sendMessageQuery({
        chatflowid: props.chatflowid,
        apiHost: props.apiHost,
        body,
        onRequest: props.onRequest,
      });

      if (result.data) {
        const data = result.data;

        let text = '';
        if (data.text) text = data.text;
        else if (data.json) text = JSON.stringify(data.json, null, 2);
        else text = JSON.stringify(data, null, 2);

        if (data?.chatId) setChatId(data.chatId);

        playReceiveSound();

        setMessages((prevMessages) => {
          const allMessages = [...cloneDeep(prevMessages)];
          const newMessage = {
            message: text,
            id: data?.chatMessageId,
            sourceDocuments: data?.sourceDocuments,
            usedTools: data?.usedTools,
            fileAnnotations: data?.fileAnnotations,
            agentReasoning: data?.agentReasoning,
            action: data?.action,
            artifacts: data?.artifacts,
            type: 'apiMessage' as messageType,
            feedback: null,
            dateTime: new Date().toISOString(),
          };
          allMessages.push(newMessage);
          addChatMessage(allMessages);
          return allMessages;
        });

        updateMetadata(data, value);

        setLoading(false);
        setUserInput('');
        setUploadedFiles([]);
        scrollToBottom();
      }
      if (result.error) {
        const error = result.error;
        console.error(error);
        if (typeof error === 'object') {
          handleError(`Hata: ${error?.message.replaceAll('Hata:', ' ')}`);
          return;
        }
        if (typeof error === 'string') {
          handleError(error);
          return;
        }
        handleError();
        return;
      }
    }

    // base64 verilerini localStorage'a kaydetmekten kaçınmak için son soruyu güncelleyin
    if (uploads && uploads.length > 0) {
      setMessages((data) => {
        const messages = data.map((item, i) => {
          if (i === data.length - 2 && item.type === 'userMessage') {
            if (item.fileUploads) {
              const fileUploads = item?.fileUploads.map((file) => ({
                type: file.type,
                name: file.name,
                mime: file.mime,
              }));
              return { ...item, fileUploads };
            }
          }
          return item;
        });
        addChatMessage(messages);
        return [...messages];
      });
    }
  };

  const handleActionClick = async (label: string, action: IAction | undefined | null) => {
    setUserInput(label);
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, action: null };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
    handleSubmit(label, action);
  };

  const clearChat = () => {
    try {
      removeLocalStorageChatHistory(props.chatflowid);
      setChatId(
        (props.chatflowConfig?.vars as any)?.customerId ? `${(props.chatflowConfig?.vars as any).customerId.toString()}+${uuidv4()}` : uuidv4(),
      );
      setUploadedFiles([]);
      const messages: MessageType[] = [
        {
          message: props.welcomeMessage ?? defaultWelcomeMessage,
          type: 'apiMessage',
        },
      ];
      if (leadsConfig()?.status && !getLocalStorageChatflow(props.chatflowid)?.lead) {
        messages.push({ message: '', type: 'leadCaptureMessage' });
      }
      setMessages(messages);
    } catch (error: any) {
      const errorData = error.response.data || `${error.response.status}: ${error.response.statusText}`;
      console.error(`hata: ${errorData}`);
    }
  };

  onMount(() => {
    if (props.clearChatOnReload) {
      clearChat();
      window.addEventListener('beforeunload', clearChat);
      return () => {
        window.removeEventListener('beforeunload', clearChat);
      };
    }
  });

  createEffect(() => {
    if (props.starterPrompts) {
      let prompts: string[];

      if (Array.isArray(props.starterPrompts)) {
        // starterPrompts bir dizi ise
        prompts = props.starterPrompts;
      } else {
        // starterPrompts bir JSON nesnesi ise
        prompts = Object.values(props.starterPrompts).map((promptObj: { prompt: string }) => promptObj.prompt);
      }

      // Boş istemleri filtreleyin
      return setStarterPrompts(prompts.filter((prompt) => prompt !== ''));
    }
  });

  // Sohbeti otomatik olarak aşağı kaydır
  createEffect(() => {
    if (messages()) {
      if (messages().length > 1) {
        setTimeout(() => {
          chatContainer?.scrollTo(0, chatContainer.scrollHeight);
        }, 400);
      }
    }
  });

  createEffect(() => {
    if (props.fontSize && botContainer) botContainer.style.fontSize = `${props.fontSize}px`;
  });

  // eslint-disable-next-line solid/reactivity
  createEffect(async () => {
    if (props.disclaimer) {
      if (getCookie('chatbotDisclaimer') == 'true') {
        setDisclaimerPopupOpen(false);
      } else {
        setDisclaimerPopupOpen(true);
      }
    } else {
      setDisclaimerPopupOpen(false);
    }

    const chatMessage = getLocalStorageChatflow(props.chatflowid);
    if (chatMessage && Object.keys(chatMessage).length) {
      if (chatMessage.chatId) setChatId(chatMessage.chatId);
      const savedLead = chatMessage.lead;
      if (savedLead) {
        setIsLeadSaved(!!savedLead);
        setLeadEmail(savedLead.email);
      }
      const loadedMessages: MessageType[] =
        chatMessage?.chatHistory?.length > 0
          ? chatMessage.chatHistory?.map((message: MessageType) => {
              const chatHistory: MessageType = {
                messageId: message?.messageId,
                message: message.message,
                type: message.type,
                rating: message.rating,
                dateTime: message.dateTime,
              };
              if (message.sourceDocuments) chatHistory.sourceDocuments = message.sourceDocuments;
              if (message.fileAnnotations) chatHistory.fileAnnotations = message.fileAnnotations;
              if (message.fileUploads) chatHistory.fileUploads = message.fileUploads;
              if (message.agentReasoning) chatHistory.agentReasoning = message.agentReasoning;
              if (message.action) chatHistory.action = message.action;
              if (message.artifacts) chatHistory.artifacts = message.artifacts;
              if (message.followUpPrompts) chatHistory.followUpPrompts = message.followUpPrompts;
              return chatHistory;
            })
          : [{ message: props.welcomeMessage ?? defaultWelcomeMessage, type: 'apiMessage' }];

      const filteredMessages = loadedMessages.filter((message) => message.type !== 'leadCaptureMessage');
      setMessages([...filteredMessages]);
    }

    // Belirli bir chatflow'un akış için uygun olup olmadığını belirleyin
    const { data } = await isStreamAvailableQuery({
      chatflowid: props.chatflowid,
      apiHost: props.apiHost,
      onRequest: props.onRequest,
    });

    if (data) {
      setIsChatFlowAvailableToStream(data?.isStreaming ?? false);
    }

    // chatbotConfig'i alın
    const result = await getChatbotConfig({
      chatflowid: props.chatflowid,
      apiHost: props.apiHost,
      onRequest: props.onRequest,
    });

    if (result.data) {
      const chatbotConfig = result.data;
      if ((!props.starterPrompts || props.starterPrompts?.length === 0) && chatbotConfig.starterPrompts) {
        const prompts: string[] = [];
        Object.getOwnPropertyNames(chatbotConfig.starterPrompts).forEach((key) => {
          prompts.push(chatbotConfig.starterPrompts[key].prompt);
        });
        setStarterPrompts(prompts.filter((prompt) => prompt !== ''));
      }
      if (chatbotConfig.chatFeedback) {
        const chatFeedbackStatus = chatbotConfig.chatFeedback.status;
        setChatFeedbackStatus(chatFeedbackStatus);
      }
      if (chatbotConfig.uploads) {
        setUploadsConfig(chatbotConfig.uploads);
      }
      if (chatbotConfig.leads) {
        setLeadsConfig(chatbotConfig.leads);
        if (chatbotConfig.leads?.status && !getLocalStorageChatflow(props.chatflowid)?.lead) {
          setMessages((prevMessages) => [...prevMessages, { message: '', type: 'leadCaptureMessage' }]);
        }
      }
      if (chatbotConfig.followUpPrompts) {
        setFollowUpPromptsStatus(chatbotConfig.followUpPrompts.status);
      }
    }

    // eslint-disable-next-line solid/reactivity
    return () => {
      setUserInput('');
      setUploadedFiles([]);
      setLoading(false);
      setMessages([
        {
          message: props.welcomeMessage ?? defaultWelcomeMessage,
          type: 'apiMessage',
        },
      ]);
    };
  });

  createEffect(() => {
    if (followUpPromptsStatus() && messages().length > 0) {
      const lastMessage = messages()[messages().length - 1];
      if (lastMessage.type === 'apiMessage' && lastMessage.followUpPrompts) {
        setFollowUpPrompts(JSON.parse(lastMessage.followUpPrompts));
      } else if (lastMessage.type === 'userMessage') {
        setFollowUpPrompts([]);
      }
    }
  });

  const addRecordingToPreviews = (blob: Blob) => {
    let mimeType = '';
    const pos = blob.type.indexOf(';');
    if (pos === -1) {
      mimeType = blob.type;
    } else {
      mimeType = blob.type.substring(0, pos);
    }

    // blob'u okuyun ve önizlemelere ekleyin
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as FilePreviewData;
      const upload: FilePreview = {
        data: base64data,
        preview: '../assets/wave-sound.jpg',
        type: 'audio',
        name: `audio_${Date.now()}.wav`,
        mime: mimeType,
      };
      setPreviews((prevPreviews) => [...prevPreviews, upload]);
    };
  };

  const isFileAllowedForUpload = (file: File) => {
    let acceptFile = false;
    if (uploadsConfig() && uploadsConfig()?.isImageUploadAllowed && uploadsConfig()?.imgUploadSizeAndTypes) {
      const fileType = file.type;
      const sizeInMB = file.size / 1024 / 1024;
      uploadsConfig()?.imgUploadSizeAndTypes.map((allowed) => {
        if (allowed.fileTypes.includes(fileType) && sizeInMB <= allowed.maxUploadSize) {
          acceptFile = true;
        }
      });
    }
    if (uploadsConfig() && uploadsConfig()?.isFileUploadAllowed && uploadsConfig()?.fileUploadSizeAndTypes) {
      const fileExt = file.name.split('.').pop();
      if (fileExt) {
        uploadsConfig()?.fileUploadSizeAndTypes.map((allowed) => {
          if (allowed.fileTypes.length === 1 && allowed.fileTypes[0] === '*') {
            acceptFile = true;
          } else if (allowed.fileTypes.includes(`.${fileExt}`)) {
            acceptFile = true;
          }
        });
      }
    }
    if (!acceptFile) {
      alert(`Dosya yüklenemiyor. Lütfen izin verilen dosya türlerini ve maksimum izin verilen boyutu kontrol edin.`);
    }
    return acceptFile;
  };

  const handleFileChange = async (event: FileEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    const filesList = [];
    const uploadedFiles = [];
    for (const file of files) {
      if (isFileAllowedForUpload(file) === false) {
        return;
      }
      // Yalnızca dosyaları ekleyin
      if (
        !uploadsConfig()
          ?.imgUploadSizeAndTypes.map((allowed) => allowed.fileTypes)
          .join(',')
          .includes(file.type)
      ) {
        uploadedFiles.push(file);
      }
      const reader = new FileReader();
      const { name } = file;
      filesList.push(
        new Promise((resolve) => {
          reader.onload = (evt) => {
            if (!evt?.target?.result) {
              return;
            }
            const { result } = evt.target;
            resolve({
              data: result,
              preview: URL.createObjectURL(file),
              type: 'file',
              name: name,
              mime: file.type,
            });
          };
          reader.readAsDataURL(file);
        }),
      );
    }

    const newFiles = await Promise.all(filesList);
    setUploadedFiles(uploadedFiles);
    setPreviews((prevPreviews) => [...prevPreviews, ...(newFiles as FilePreview[])]);
  };

  const handleDrag = (e: DragEvent) => {
    if (uploadsConfig()?.isImageUploadAllowed || uploadsConfig()?.isFileUploadAllowed) {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setIsDragActive(true);
      } else if (e.type === 'dragleave') {
        setIsDragActive(false);
      }
    }
  };

  const handleDrop = async (e: InputEvent | DragEvent) => {
    if (!uploadsConfig()?.isImageUploadAllowed && !uploadsConfig()?.isFileUploadAllowed) {
      return;
    }
    e.preventDefault();
    setIsDragActive(false);
    const files = [];
    const uploadedFiles = [];
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      for (const file of e.dataTransfer.files) {
        if (isFileAllowedForUpload(file) === false) {
          return;
        }
        // Yalnızca dosyaları ekleyin
        if (
          !uploadsConfig()
            ?.imgUploadSizeAndTypes.map((allowed) => allowed.fileTypes)
            .join(',')
            .includes(file.type)
        ) {
          uploadedFiles.push(file);
        }
        const reader = new FileReader();
        const { name } = file;
        files.push(
          new Promise((resolve) => {
            reader.onload = (evt) => {
              if (!evt?.target?.result) {
                return;
              }
              const { result } = evt.target;
              let previewUrl;
              if (file.type.startsWith('audio/')) {
                previewUrl = '../assets/wave-sound.jpg';
              } else if (file.type.startsWith('image/')) {
                previewUrl = URL.createObjectURL(file);
              }
              resolve({
                data: result,
                preview: previewUrl,
                type: 'file',
                name: name,
                mime: file.type,
              });
            };
            reader.readAsDataURL(file);
          }),
        );
      }

      const newFiles = await Promise.all(files);
      setUploadedFiles(uploadedFiles);
      setPreviews((prevPreviews) => [...prevPreviews, ...(newFiles as FilePreview[])]);
    }

    if (e.dataTransfer && e.dataTransfer.items) {
      for (const item of e.dataTransfer.items) {
        if (item.kind === 'string' && item.type.match('^text/uri-list')) {
          item.getAsString((s: string) => {
            const upload: FilePreview = {
              data: s,
              preview: s,
              type: 'url',
              name: s.substring(s.lastIndexOf('/') + 1),
              mime: '',
            };
            setPreviews((prevPreviews) => [...prevPreviews, upload]);
          });
        } else if (item.kind === 'string' && item.type.match('^text/html')) {
          item.getAsString((s: string) => {
            if (s.indexOf('href') === -1) return;
            // href'i çıkar
            const start = s.substring(s.indexOf('href') + 6);
            const hrefStr = start.substring(0, start.indexOf('"'));

            const upload: FilePreview = {
              data: hrefStr,
              preview: hrefStr,
              type: 'url',
              name: hrefStr.substring(hrefStr.lastIndexOf('/') + 1),
              mime: '',
            };
            setPreviews((prevPreviews) => [...prevPreviews, upload]);
          });
        }
      }
    }
  };

  const handleDeletePreview = (itemToDelete: FilePreview) => {
    if (itemToDelete.type === 'file') {
      URL.revokeObjectURL(itemToDelete.preview); // Dosya için temizleme
    }
    setPreviews(previews().filter((item) => item !== itemToDelete));
  };

  const onMicrophoneClicked = () => {
    setIsRecording(true);
    startAudioRecording(setIsRecording, setRecordingNotSupported, setElapsedTime);
  };

  const onRecordingCancelled = () => {
    if (!recordingNotSupported) cancelAudioRecording();
    setIsRecording(false);
    setRecordingNotSupported(false);
  };

  const onRecordingStopped = async () => {
    setIsLoadingRecording(true);
    stopAudioRecording(addRecordingToPreviews);
  };

  const getInputDisabled = (): boolean => {
    const messagesArray = messages();
    const disabled =
      loading() ||
      !props.chatflowid ||
      (leadsConfig()?.status && !isLeadSaved()) ||
      (messagesArray[messagesArray.length - 1].action && Object.keys(messagesArray[messagesArray.length - 1].action as any).length > 0);
    if (disabled) {
      return true;
    }
    return false;
  };

  createEffect(
    // önizlemelerdeki değişiklikleri dinleyin
    on(previews, (uploads) => {
      // ses kaydının yüklenmesini bekleyin ve ardından gönderin
      const containsAudio = uploads.filter((item) => item.type === 'audio').length > 0;
      if (uploads.length >= 1 && containsAudio) {
        setIsRecording(false);
        setRecordingNotSupported(false);
        promptClick('');
      }

      return () => {
        setPreviews([]);
      };
    }),
  );

  const previewDisplay = (item: FilePreview) => {
    if (item.mime.startsWith('image/')) {
      return (
        <button
          class="group w-12 h-12 flex items-center justify-center relative rounded-[10px] overflow-hidden transition-colors duration-200"
          onClick={() => handleDeletePreview(item)}
        >
          <img class="w-full h-full bg-cover" src={item.data as string} />
          <span class="absolute hidden group-hover:flex items-center justify-center z-10 w-full h-full top-0 left-0 bg-black/10 rounded-[10px] transition-colors duration-200">
            <TrashIcon />
          </span>
        </button>
      );
    } else if (item.mime.startsWith('audio/')) {
      return (
        <div
          class={`inline-flex basis-auto flex-grow-0 flex-shrink-0 justify-between items-center rounded-xl h-12 p-1 mr-1 bg-gray-500`}
          style={{
            width: `${chatContainer ? (botProps.isFullPage ? chatContainer?.offsetWidth / 4 : chatContainer?.offsetWidth / 2) : '200'}px`,
          }}
        >
          <audio class="block bg-cover bg-center w-full h-full rounded-none text-transparent" controls src={item.data as string} />
          <button class="w-7 h-7 flex items-center justify-center bg-transparent p-1" onClick={() => handleDeletePreview(item)}>
            <TrashIcon color="white" />
          </button>
        </div>
      );
    } else {
      return <FilePreview item={item} onDelete={() => handleDeletePreview(item)} />;
    }
  };

  return (
    <>
      <div
        ref={botContainer}
        class={'relative flex w-full h-full text-base overflow-hidden bg-cover bg-center flex-col items-center chatbot-container ' + props.class}
        onDragEnter={handleDrag}
      >
        {isDragActive() && (
          <div
            class="absolute top-0 left-0 bottom-0 right-0 w-full h-full z-50"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragEnd={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          />
        )}
        {isDragActive() && (uploadsConfig()?.isImageUploadAllowed || uploadsConfig()?.isFileUploadAllowed) && (
          <div
            class="absolute top-0 left-0 bottom-0 right-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-white z-40 gap-2 border-2 border-dashed"
            style={{ 'border-color': props.bubbleBackgroundColor }}
          >
            <h2 class="text-xl font-semibold">Yüklemek için buraya bırakın</h2>
            <For each={[...(uploadsConfig()?.imgUploadSizeAndTypes || []), ...(uploadsConfig()?.fileUploadSizeAndTypes || [])]}>
              {(allowed) => {
                return (
                  <>
                    <span>{allowed.fileTypes?.join(', ')}</span>
                    {allowed.maxUploadSize && <span>Maksimum İzin Verilen Boyut: {allowed.maxUploadSize} MB</span>}
                  </>
                );
              }}
            </For>
          </div>
        )}

        {props.showTitle ? (
          <div
            class="flex flex-row items-center w-full h-[50px] absolute top-0 left-0 z-10"
            style={{
              background: props.bubbleBackgroundColor,
              color: props.bubbleTextColor,
              'border-top-left-radius': props.isFullPage ? '0px' : '6px',
              'border-top-right-radius': props.isFullPage ? '0px' : '6px',
            }}
          >
            <Show when={props.titleAvatarSrc}>
              <>
                <div style={{ width: '15px' }} />
                <Avatar initialAvatarSrc={props.titleAvatarSrc} />
              </>
            </Show>
            <Show when={props.title}>
              <span class="px-3 whitespace-pre-wrap font-semibold max-w-full">{props.title}</span>
            </Show>
            <div style={{ flex: 1 }} />
            <DeleteButton
              sendButtonColor={props.bubbleTextColor}
              type="button"
              isDisabled={messages().length === 1}
              class="my-2 ml-2"
              on:click={clearChat}
            >
              <span style={{ 'font-family': 'Poppins, sans-serif' }}>Temizle</span>
            </DeleteButton>
          </div>
        ) : null}
        <div class="flex flex-col w-full h-full justify-start z-0">
          <div
            ref={chatContainer}
            class="overflow-y-scroll flex flex-col flex-grow min-w-full w-full px-3 pt-[70px] relative scrollable-container chatbot-chat-view scroll-smooth"
          >
            <For each={[...messages()]}>
              {(message, index) => {
                return (
                  <>
                    {message.type === 'userMessage' && (
                      <GuestBubble
                        message={message}
                        apiHost={props.apiHost}
                        chatflowid={props.chatflowid}
                        chatId={chatId()}
                        backgroundColor={props.userMessage?.backgroundColor}
                        textColor={props.userMessage?.textColor}
                        showAvatar={props.userMessage?.showAvatar}
                        avatarSrc={props.userMessage?.avatarSrc}
                        fontSize={props.fontSize}
                        renderHTML={props.renderHTML}
                      />
                    )}
                    {message.type === 'apiMessage' && (
                      <BotBubble
                        message={message}
                        fileAnnotations={message.fileAnnotations}
                        chatflowid={props.chatflowid}
                        chatId={chatId()}
                        apiHost={props.apiHost}
                        backgroundColor={props.botMessage?.backgroundColor}
                        textColor={props.botMessage?.textColor}
                        feedbackColor={props.feedback?.color}
                        showAvatar={props.botMessage?.showAvatar}
                        avatarSrc={props.botMessage?.avatarSrc}
                        chatFeedbackStatus={chatFeedbackStatus()}
                        fontSize={props.fontSize}
                        isLoading={loading() && index() === messages().length - 1}
                        showAgentMessages={props.showAgentMessages}
                        handleActionClick={(label, action) => handleActionClick(label, action)}
                        sourceDocsTitle={props.sourceDocsTitle}
                        handleSourceDocumentsClick={(sourceDocuments) => {
                          setSourcePopupSrc(sourceDocuments);
                          setSourcePopupOpen(true);
                        }}
                        dateTimeToggle={props.dateTimeToggle}
                        renderHTML={props.renderHTML}
                      />
                    )}
                    {message.type === 'leadCaptureMessage' && leadsConfig()?.status && !getLocalStorageChatflow(props.chatflowid)?.lead && (
                      <LeadCaptureBubble
                        message={message}
                        chatflowid={props.chatflowid}
                        chatId={chatId()}
                        apiHost={props.apiHost}
                        backgroundColor={props.botMessage?.backgroundColor}
                        textColor={props.botMessage?.textColor}
                        fontSize={props.fontSize}
                        showAvatar={props.botMessage?.showAvatar}
                        avatarSrc={props.botMessage?.avatarSrc}
                        leadsConfig={leadsConfig()}
                        sendButtonColor={props.textInput?.sendButtonColor}
                        isLeadSaved={isLeadSaved()}
                        setIsLeadSaved={setIsLeadSaved}
                        setLeadEmail={setLeadEmail}
                      />
                    )}
                    {message.type === 'userMessage' && loading() && index() === messages().length - 1 && <LoadingBubble />}
                    {message.type === 'apiMessage' && message.message === '' && loading() && index() === messages().length - 1 && <LoadingBubble />}
                  </>
                );
              }}
            </For>
          </div>
          <Show when={messages().length === 1}>
            <Show when={starterPrompts().length > 0}>
              <div class="w-full flex flex-row flex-wrap px-5 py-[10px] gap-2">
                <For each={[...starterPrompts()]}>
                  {(key) => (
                    <StarterPromptBubble
                      prompt={key}
                      onPromptClick={() => promptClick(key)}
                      starterPromptFontSize={botProps.starterPromptFontSize} // Burada bir sayı olarak geçirin
                    />
                  )}
                </For>
              </div>
            </Show>
          </Show>
          <Show when={messages().length > 2 && followUpPromptsStatus()}>
            <Show when={followUpPrompts().length > 0}>
              <>
                <div class="flex items-center gap-1 px-5">
                  <SparklesIcon class="w-4 h-4" />
                  <span class="text-sm text-gray-700">Bu istemleri deneyin</span>
                </div>
                <div class="w-full flex flex-row flex-wrap px-5 py-[10px] gap-2">
                  <For each={[...followUpPrompts()]}>
                    {(prompt, index) => (
                      <FollowUpPromptBubble
                        prompt={prompt}
                        onPromptClick={() => followUpPromptClick(prompt)}
                        starterPromptFontSize={botProps.starterPromptFontSize} // Burada bir sayı olarak geçirin
                      />
                    )}
                  </For>
                </div>
              </>
            </Show>
          </Show>
          <Show when={previews().length > 0}>
            <div class="w-full flex items-center justify-start gap-2 px-5 pt-2 border-t border-[#eeeeee]">
              <For each={[...previews()]}>{(item) => <>{previewDisplay(item)}</>}</For>
            </div>
          </Show>
          <div class="w-full px-5 pt-2 pb-1">
            {isRecording() ? (
              <>
                {recordingNotSupported() ? (
                  <div class="w-full flex items-center justify-between p-4 border border-[#eeeeee]">
                    <div class="w-full flex items-center justify-between gap-3">
                      <span class="text-base">Ses kaydetmek için, ses kaydını destekleyen modern tarayıcılar (Chrome veya Firefox gibi) kullanın.</span>
                      <button
                        class="py-2 px-4 justify-center flex items-center bg-red-500 text-white rounded-md"
                        type="button"
                        onClick={() => onRecordingCancelled()}
                      >
                        Tamam
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    class="h-[58px] flex items-center justify-between chatbot-input border border-[#eeeeee]"
                    data-testid="input"
                    style={{
                      margin: 'auto',
                      'background-color': props.textInput?.backgroundColor ?? defaultBackgroundColor,
                      color: props.textInput?.textColor ?? defaultTextColor,
                    }}
                  >
                    <div class="flex items-center gap-3 px-4 py-2">
                      <span>
                        <CircleDotIcon color="red" />
                      </span>
                      <span>{elapsedTime() || '00:00'}</span>
                      {isLoadingRecording() && <span class="ml-1.5">Gönderiliyor...</span>}
                    </div>
                    <div class="flex items-center">
                      <CancelButton buttonColor={props.textInput?.sendButtonColor} type="button" class="m-0" on:click={onRecordingCancelled}>
                        <span style={{ 'font-family': 'Poppins, sans-serif' }}>Gönder</span>
                      </CancelButton>
                      <SendButton
                        sendButtonColor={props.textInput?.sendButtonColor}
                        type="button"
                        isDisabled={loading()}
                        class="m-0"
                        on:click={onRecordingStopped}
                      >
                        <span style={{ 'font-family': 'Poppins, sans-serif' }}>Gönder</span>
                      </SendButton>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <TextInput
                backgroundColor={props.textInput?.backgroundColor}
                textColor={props.textInput?.textColor}
                placeholder={props.textInput?.placeholder}
                sendButtonColor={props.textInput?.sendButtonColor}
                maxChars={props.textInput?.maxChars}
                maxCharsWarningMessage={props.textInput?.maxCharsWarningMessage}
                autoFocus={props.textInput?.autoFocus}
                fontSize={props.fontSize}
                disabled={getInputDisabled()}
                defaultValue={userInput()}
                onSubmit={handleSubmit}
                uploadsConfig={uploadsConfig()}
                setPreviews={setPreviews}
                onMicrophoneClicked={onMicrophoneClicked}
                handleFileChange={handleFileChange}
                sendMessageSound={props.textInput?.sendMessageSound}
                sendSoundLocation={props.textInput?.sendSoundLocation}
              />
            )}
          </div>
          <Badge
            footer={props.footer}
            badgeBackgroundColor={props.badgeBackgroundColor}
            poweredByTextColor={props.poweredByTextColor}
            botContainer={botContainer}
          />
        </div>
      </div>
      {sourcePopupOpen() && <Popup isOpen={sourcePopupOpen()} value={sourcePopupSrc()} onClose={() => setSourcePopupOpen(false)} />}

      {disclaimerPopupOpen() && (
        <DisclaimerPopup
          isOpen={disclaimerPopupOpen()}
          onAccept={handleDisclaimerAccept}
          title={props.disclaimer?.title}
          message={props.disclaimer?.message}
          buttonText={props.disclaimer?.buttonText}
        />
      )}
    </>
  );
};
