This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## # Nestor
### Personal Work Intelligence System (PWIS)

Version: 1.0

---

# 1. Vision

Nestor is a cloud-based Personal Work Intelligence System inspired by Nestor from Greek mythology, who was known for wisdom, organization, and strategic guidance.

The goal of Nestor is to replace scattered productivity tools such as:

- Excel sheets
- Paper diaries
- Sticky notes
- Calendar notes
- AI-generated report documents
- Personal work journals

with one centralized platform.

The application should become the single source of truth for all daily work activities.

Nestor is NOT a simple task management application.

It is a personal work operating system designed primarily for IT Operations, SOC Analysts, System Administrators and Cyber Security professionals.

---

# 2. Problem Statement

My daily work requires maintaining information across multiple places.

Current workflow includes

• Ticket Log in Excel

• Self-learning diary

• Meeting notes

• Calendar reminders

• Daily work diary

• Weekly reports

• Monthly reports

• AI tools for report generation

This workflow causes

- duplicate work
- missing information
- difficult searching
- manual report generation
- poor visibility of completed work
- excessive context switching

The objective of Nestor is to centralize all work into one application.

---

# 3. Objectives

The application should

- Store every work activity
- Organize tickets
- Organize daily tasks
- Organize meetings
- Track learning
- Generate reports
- Display analytics
- Provide AI-ready structured data
- Reduce manual work

---

# 4. Development Philosophy

This project should follow the following principles.

## Feature First Architecture

The project must NOT follow MVC architecture.

Avoid folders such as

Controllers

Models

Routes

Services

Instead use Feature-Based Architecture.

Each feature owns its own

- Components
- Hooks
- Validation
- Types
- API
- Business Logic
- Utilities

The application should remain modular and scalable.

---

# 5. Technology Stack

Frontend

- Next.js (App Router)
- React
- TypeScript

Styling

- Tailwind CSS
- shadcn/ui

Animation

- Framer Motion

State Management

- Zustand

Server State

- TanStack Query

Forms

- React Hook Form

Validation

- Zod

Charts

- Recharts

Calendar

- FullCalendar

Icons

- Lucide React

Database

- Supabase PostgreSQL

Storage

- Supabase Storage

Authentication

- Supabase Auth (Future)

Deployment

Frontend

Vercel

Backend

Supabase

AI

Gemini API 
---

# 6. UI Philosophy

The UI should be

- dark mode and whitemode theme based options 
- Minimal
- Clean
- Modern
- Professional

Inspired by

- Linear
- GitHub
- Notion
- Vercel Dashboard

Avoid

- flashy gradients
- excessive animations
- unnecessary glassmorphism

Animations should be subtle.



---

# 7. Core Concept

Everything in the application should revolve around Activities.

Activities include

- Ticket
- Task
- Meeting
- Learning
- Reading
- Documentation
- Research
- Health Check
- Personal Work

The dashboard, reports, timeline and AI features should all consume Activity data instead of maintaining duplicate logic.

---

# 8. Features

---

## Dashboard

The Dashboard should provide an overview of all work.

Display

- Total Tickets
- Open Tickets
- Closed Tickets
- Awaiting Information Tickets
- In Progress Tickets

- Total Tasks
- Completed Tasks
- Pending Tasks

- Today's Work

- Recent Activities

- Completion Percentage

- Productivity Statistics

Charts

- Tickets by Priority

- Tasks by Status

- Work Category Distribution

Filters

- Today
- Weekly
- Monthly
- Custom Date Range

Dashboard must never store data itself.

It should consume data from the Task and Ticket modules.

---

## Navigation

Permanent left sidebar.

Modules

Dashboard

Ticket Log

Task Log

Reports

Calendar

Settings

AI Assistant

---

# Ticket Module

Ticket List

Columns

- Ticket ID
- Customer ID
- Subject
- Status
- Priority

Toolbar

Search

Date Filter

Status Filter

Priority Filter

Customer Filter

Add Button

Double clicking a ticket opens Ticket Details.

Ticket Details contain

- Sr No
- Date
- Product
- Ticket ID
- Customer ID
- Customer Name
- Subject
- Details
- Priority
- Raised By
- Created Date
- Status
- My Work
- Comments

Actions

Update

Delete

Save

Cancel

---

# Task Module

Task List

Columns

Task Name

Category

Status

Duration

Tags

Date

Toolbar

Search

Status Filter

Category Filter

Tag Filter

Date Filter

Add Task

Double clicking opens Task Details.

Task contains

Title

Description

Category

Status

Tags

Notes

Sessions

A task may have multiple sessions.

Example

09:00-10:00

13:00-14:00

20:00-21:30

Total Duration should calculate automatically.

Task Categories

Learning

Meeting

Operations

Personal

Research

Documentation

Automation

Health Check

Custom

Task Tags

Unlimited custom tags.

Examples

Trellix

Symantec

PAM

DAM

Linux

Windows

Meeting

Azure

AWS

Reading

MITRE

CNAPP

These tags will later help AI generate reports.

---

# Reports

Reports are the primary feature of Nestor.

Supported Reports

Ticket Report

Task Report

Overall Report

Learning Report

Meeting Report

Custom Report

Filters

Today

Weekly

Monthly

Custom Date

Category

Tags

Priority

Status

Output Formats

HTML

PDF

CSV

Future

DOCX

AI Summary

Each report should display

Summary

Statistics

Charts

Detailed List

Time Spent

Completion

---

# Calendar

Monthly Calendar

Clicking a day opens Day Summary.

Display

Tickets

Tasks

Meetings

Learning

Activities

Calendar should read Activity data instead of storing duplicate information.

---

# Search

Global Search

Search should work across

Tasks

Tickets

Customers

Meetings

Tags

Comments

Notes

---

# AI (Future)

Natural Language Queries

Examples

Generate weekly report

What did I work on yesterday?

Show all Trellix tickets

How much time did I spend learning?

Generate manager summary

Summarize this month

---

# Learning Tracker (Future)

Track

Courses

Books

Labs

Certifications

Progress

Hours

Completion

---

# Notifications (Future)

Meeting reminders

Task reminders

Deadline reminders

Report reminders

---

# Attachments (Future)

Tickets

Tasks

Meetings

should support

Images

PDF

Logs

ZIP

---

# 9. Non Functional Requirements

The application must be

Scalable

Responsive

Modular

Reusable

Accessible

Fast

Maintainable

Production Ready

Type Safe

---

# 10. Folder Structure

Use Feature First Architecture.

Example

src

app

shared

features

dashboard

ticket

task

reports

calendar

activity

settings

Each feature owns

components

hooks

schemas

services

types

utils

No MVC architecture.

---

# 11. Coding Standards

Use strict TypeScript.

Use reusable components.

Use custom hooks.

Business logic should not exist inside UI components.

Validation should use Zod.

Forms should use React Hook Form.

Database communication should remain isolated.

Avoid duplicated logic.

Prefer composition over inheritance.

---

# 12. Roadmap

Phase 1

Dashboard

Task Module

Dashboard Integration

Phase 2

Ticket Module

Dashboard Integration

Phase 3

Reports

Export

Statistics

Phase 4

Calendar

Timeline

Activity Module

Phase 5

Authentication

Settings

Attachments

Phase 6

AI Assistant

Natural Language Search

AI Report Generation

Phase 7

Notifications

Learning Tracker

Backup

Mobile Optimization

---

# Final Goal

Nestor should become a Personal Work Intelligence System that automatically records, organizes, analyzes and summarizes all work activities in one place.

The application should eliminate manual Excel tracking, manual report writing and scattered notes while remaining scalable enough to evolve into a production-ready SaaS platform in the future.
