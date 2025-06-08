import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    backendData?: any
  }

  interface User {
    backendData?: any
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    backendData?: any
  }
} 