# BetterBox - LinkedIn Messaging Application

## Project Overview

BetterBox is a comprehensive LinkedIn messaging application built with Next.js, TRPC, and Prisma. It integrates with the Unipile API to provide users with a unified LinkedIn inbox experience, allowing them to manage their LinkedIn conversations from a single interface.

## Core Features

- **LinkedIn Inbox Integration**: Complete synchronization with LinkedIn messages through Unipile API
- **Real-time Messaging**: Live message updates and notifications using Inngest
- **Contact Management**: Rich contact profiles with LinkedIn profile data
- **Message Management**: Send, receive, delete, and manage LinkedIn messages
- **Chat Organization**: Grouped chats by provider with unread indicators
- **Read Status Management**: Mark conversations as read/unread
- **Authentication**: Secure user authentication via Clerk

## Technical Stack

- **Frontend**: Next.js 14+ with React, TypeScript, Tailwind CSS
- **Backend**: TRPC for type-safe API, Prisma ORM
- **Database**: PostgreSQL with comprehensive LinkedIn data models
- **External APIs**: Unipile API for LinkedIn integration
- **Real-time**: Inngest for background jobs and real-time updates
- **Authentication**: Clerk for user management

## Key Integrations

- **Unipile API**: Primary integration for LinkedIn messaging functionality
- **Clerk**: User authentication and session management
- **Inngest**: Background job processing and real-time features

## Project Goals

1. Provide a superior LinkedIn messaging experience
2. Centralize LinkedIn inbox management
3. Enable advanced message organization and filtering
4. Support real-time collaboration and notifications
5. Maintain data synchronization between local database and LinkedIn 