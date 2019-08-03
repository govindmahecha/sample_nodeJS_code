module.exports = {
  auth: {
    loginLinkedIn: '/api/auth/login/linkedin',
    loginLinkedInCallback: '/auth/linkedin/callback',
    loginGoogle: '/api/auth/login/google',
    loginGoogleCallback: '/auth/google/callback',
    loginEmail: '/api/auth/login/email',
    signupEmail: '/api/auth/login/email-signup',
    forgotEmailLoginPassword: '/api/auth/login/forgot-email-password',
    logout: '/api/auth/logout',
  },
  user: {
    profile: '/api/profile/user/:id/community/:slug',
    selfProfile : '/api/profile/user/:id',
    updateProfile: '/api/profile/user/:id',
    sendVerifyEmail: '/api/profile/me/verify-email/send-email',
    resetPasswordEmail: '/api/profile/me/reset-password/send-email',
    resetPassword: '/profile/me/reset-password/:token',
    communities: '/api/profile/me/communities',
    verifyEmail: '/verify-email/:token',
    namesList: '/api/profile/upvote/names-list'
  },
  community: {
    get: '/api/community/:slug',
    getAdmin: '/api/community/:slug/admin',
    join: '/api/community/:slug/join/:token',
    people: '/api/community/:slug/people',
    activity: '/api/community/:slug/activity',
    relevantActivity : '/api/community/:slug/activity/:userId',
    blockUser : '/api/community/:slug/block-user/:userId',
    askTags : '/api/community/:slug/ask/tags',
    offerTags : '/api/community/:slug/offer/tags',
    getMember : '/api/community/:slug/member/:userId',
    settings : '/api/community/:slug/settings'
  },
  ask: {
    get: '/api/ask/:id?',
    post: '/api/ask',
    delete : '/api/ask/:id',
    postReply: '/api/community/:slug/ask/:id/reply',
    addUpvote : '/api/ask/:id/upvote',
    deleteUpvote : '/api/ask/:id/upvote'
  },
  reply: {
    addUpvote : '/api/reply/:id/upvote',
    deleteUpvote : '/api/reply/:id/upvote'
  },
  offer: {
    get: '/api/offer/:id?',
    post: '/api/offer',
    delete : '/api/offer/:id',
    postReply: '/api/community/:slug/offer/:id/reply',
    addUpvote : '/api/offer/:id/upvote',
    deleteUpvote : '/api/offer/:id/upvote'
  },
  tag: {
    get: '/api/tag'
  },
  chat: {
    getArchive: '/api/chat/user/:from',
    markRead: '/api/chat/user/:from/markRead',
    getUnread: '/api/chat/unread',
    getAll: '/api/chat/all'
  },
  notification: {
    getAskOffer: '/api/notification/askOffer',
    updateStatus: '/api/notification/:id'
  },
  supportRequest: {
    post: '/api/support-request',
  },
  error: {
    logClientError: '/api/error/client'
  }
};
