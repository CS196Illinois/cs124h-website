# CS124H Website

Welcome to the course website for CS 124H. This site provides resources, lecture materials, past hall of fame projects, and a calendar with upcoming events for students enrolled in the course.

## About the Course

CS124 Honors is an add-on to CS 124 that lets you blend creativity and learning through a hands-on, project-based experience. You will work under the support of Project Managers and collaborate closely with other students.

## Website Overview

The course website hosts:
- Instructions on course registration
- Hall of Fame Projects
- Resources designed by course staff
- Current and past course staff
- Leaderboard
- Schedule & Calendar


## Group understanding checks

Before deploying group-scoped understanding checks, run
`scripts/migrate-group-sprint-checks.sql` in Supabase’s SQL editor (after the
question-bank migration). It updates both production and test tables.
PM additions are stored per sprint and group; shared course questions stay
required. The question bank shows shared questions plus the PM’s group’s entries.
Students receive their group’s questions, and saved submissions retain the
original question text.

Previously saved sprint questions have no author metadata, so this migration
leaves those shared arrays intact. A course lead must remove any old PM-specific
questions from shared sprints and have the relevant PM add them to their group.
Previously PM-authored bank entries are scoped to the author’s current group
when that assignment is known.


## Public image bandwidth

Staff portraits and project thumbnails use Next.js image optimization, responsive
sizes, lazy loading, and a one-day optimized-image cache. Only this project's
public `staff-images` and `site-images` buckets are allowed remote optimizer
sources; other external images keep their original URLs. Set
`NEXT_PUBLIC_SUPABASE_URL` when building and deploying.

When replacing a public image, use a new storage filename or a version query
parameter in its saved URL so visitors do not see the previous cached image for
up to a day. Keep the Next.js image cache persistent when self-hosting; on a CDN,
forward the `Accept` header to the image optimizer. This reduces future Supabase
traffic, but does not erase bandwidth already counted in the current cycle.
