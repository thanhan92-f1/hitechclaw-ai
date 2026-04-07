export type Locale = 'en' | 'vi';

export interface Translations {
  // Common
  'common.save': string;
  'common.cancel': string;
  'common.refresh': string;
  'common.delete': string;
  'common.create': string;
  'common.edit': string;
  'common.search': string;
  'common.loading': string;
  'common.noData': string;
  'common.confirm': string;
  'common.back': string;
  'common.active': string;
  'common.invited': string;
  'common.suspended': string;
  'common.system': string;
  'common.custom': string;
  'common.perms': string;
  'common.actions': string;

  // Auth
  'auth.signIn': string;
  'auth.signOut': string;
  'auth.email': string;
  'auth.password': string;
  'auth.invalidCredentials': string;
  'auth.platform': string;
  'auth.superAdmin': string;
  'auth.tenant': string;
  'auth.selectTenant': string;

  // Sidebar
  'nav.main': string;
  'nav.dashboard': string;
  'nav.chat': string;
  'nav.knowledge': string;
  'nav.knowledgeBase': string;
  'nav.ragSearch': string;
  'nav.devDocs': string;
  'nav.domains': string;
  'nav.allDomains': string;
  'nav.domainHub': string;
  'nav.tools': string;
  'nav.ollamaModels': string;
  'nav.mlAutoml': string;
  'nav.medicalTools': string;
  'nav.mcpServers': string;
  'nav.system': string;
  'nav.settings': string;

  // Dashboard
  'dashboard.title': string;
  'dashboard.subtitle': string;
  'dashboard.status': string;
  'dashboard.online': string;
  'dashboard.offline': string;
  'dashboard.uptime': string;
  'dashboard.documents': string;
  'dashboard.kbChunks': string;
  'dashboard.chatWithAi': string;
  'dashboard.chatWithAiDesc': string;
  'dashboard.uploadDocs': string;
  'dashboard.uploadDocsDesc': string;
  'dashboard.searchKnowledge': string;
  'dashboard.searchKnowledgeDesc': string;
  'dashboard.systemInfo': string;
  'dashboard.version': string;
  'dashboard.lastCheck': string;

  // Settings - general
  'settings.title': string;
  'settings.subtitle': string;

  // Settings - sidebar menu
  'settings.menu.overview': string;
  'settings.menu.users': string;
  'settings.menu.models': string;
  'settings.menu.language': string;
  'settings.menu.rag': string;
  'settings.menu.domains': string;
  'settings.menu.security': string;

  // Settings - Overview
  'settings.overview.server': string;
  'settings.overview.llmModel': string;
  'settings.overview.domains': string;
  'settings.overview.uptime': string;
  'settings.overview.available': string;
  'settings.overview.skills': string;
  'settings.overview.serverInfo': string;
  'settings.overview.status': string;
  'settings.overview.version': string;
  'settings.overview.lastCheck': string;
  'settings.overview.platform': string;
  'settings.overview.runtime': string;
  'settings.overview.activeLlm': string;
  'settings.overview.model': string;
  'settings.overview.availableModels': string;
  'settings.overview.totalSize': string;
  'settings.overview.domainPacks': string;
  'settings.overview.loadedDomains': string;
  'settings.overview.totalSkills': string;
  'settings.overview.domainStatus': string;
  'settings.overview.noDomains': string;

  // Settings - Users
  'settings.users.title': string;
  'settings.users.teamMembers': string;
  'settings.users.inviteUser': string;
  'settings.users.inviteNew': string;
  'settings.users.emailRequired': string;
  'settings.users.fullName': string;
  'settings.users.role': string;
  'settings.users.sendInvite': string;
  'settings.users.noUsers': string;
  'settings.users.suspend': string;
  'settings.users.reactivate': string;
  'settings.users.roles': string;
  'settings.users.createRole': string;
  'settings.users.roleName': string;
  'settings.users.roleDesc': string;
  'settings.users.permissions': string;
  'settings.users.noRoles': string;
  'settings.users.deleteRole': string;
  'settings.users.noDescription': string;

  // Settings - Models
  'settings.models.title': string;
  'settings.models.configDesc': string;
  'settings.models.provider': string;
  'settings.models.defaultModel': string;
  'settings.models.openaiKey': string;
  'settings.models.anthropicKey': string;
  'settings.models.ollamaUrl': string;
  'settings.models.temperature': string;
  'settings.models.availableModels': string;
  'settings.models.noModels': string;
  'settings.models.activate': string;

  // Settings - Language
  'settings.language.title': string;
  'settings.language.aiResponseLang': string;
  'settings.language.aiResponseDesc': string;
  'settings.language.autoDetect': string;
  'settings.language.autoDetectDesc': string;
  'settings.language.customInstruction': string;
  'settings.language.customDesc': string;
  'settings.language.customPlaceholder': string;
  'settings.language.saveSettings': string;
  'settings.language.saved': string;
  'settings.language.uiLanguage': string;
  'settings.language.uiLanguageDesc': string;

  // Settings - RAG
  'settings.rag.title': string;
  'settings.rag.desc': string;
  'settings.rag.chunkSize': string;
  'settings.rag.chunkOverlap': string;
  'settings.rag.topK': string;
  'settings.rag.scoreThreshold': string;
  'settings.rag.embeddingModel': string;
  'settings.rag.vectorStore': string;
  'settings.rag.supportedFiles': string;
  'settings.rag.pipeline': string;

  // Settings - Domains
  'settings.domains.title': string;
  'settings.domains.desc': string;
  'settings.domains.noSkills': string;
  'settings.domains.integrations': string;

  // Settings - Security
  'settings.security.title': string;
  'settings.security.auth': string;
  'settings.security.network': string;
  'settings.security.envVars': string;
  'settings.security.method': string;
  'settings.security.tokenExpiry': string;
  'settings.security.issuer': string;
  'settings.security.algorithm': string;
  'settings.security.corsOrigin': string;
  'settings.security.apiPort': string;
  'settings.security.https': string;
  'settings.security.rateLimit': string;

  // Setup Wizard
  'setup.welcome': string;
  'setup.welcomeDesc': string;
  'setup.agentName': string;
  'setup.language': string;
  'setup.llmTitle': string;
  'setup.llmDesc': string;
  'setup.model': string;
  'setup.provider': string;
  'setup.featuresTitle': string;
  'setup.webSearch': string;
  'setup.webSearchDesc': string;
  'setup.rag': string;
  'setup.ragDesc': string;
  'setup.workflows': string;
  'setup.workflowsDesc': string;
  'setup.domainPacks': string;
  'setup.readyTitle': string;
  'setup.readyDesc': string;
  'setup.next': string;
  'setup.launch': string;
}
