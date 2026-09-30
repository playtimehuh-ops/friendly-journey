# ModelDock

ModelDock is the second site for deploying trained custom models exported from a first-site trainer.

## Frontend constraint

The complete frontend is a single file:

- index.html

All UI CSS and browser JavaScript live inside that file. Backend API files are server-only.

## Model flow

trained model export -> import -> validate config/tokenizer/weights -> register -> owner scope -> Stripe activation -> public deployment -> load stored package -> run inference

The inference runtime uses the imported learned tensors. It does not call OpenAI, Gemini, Claude, OpenRouter, Pollinations, RAG, keyword matching, or hardcoded answer retrieval.

## Supported export shape

The importer expects a transformer-compatible package containing:

- model.config
- model.tokenizer
- model.weights

Common aliases for embeddings, attention projections, MLP weights, layer norms, and the output head are accepted so the importer can consume closely related exports.

## Persistence and isolation

The browser keeps an IndexedDB copy for the owner, while the server API can persist the complete package in Supabase under a SHA-256 owner hash. Public requests receive model metadata only; public inference loads the stored package server-side.

## Payment

Stripe Checkout is created server-side. Successful subscriptions activate the matching model through the Stripe webhook. Payment state does not modify model parameters.

## Server configuration

Configure these Vercel environment variables:

- SUPABASE_URL
- SUPABASE_SECRET_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

Run supabase/schema.sql once in the Supabase SQL editor.

Current Supabase documentation recommends the publishable/secret key pair for new integrations and notes the legacy anon/service_role keys are being deprecated by the end of 2026. citeturn955823search9

Stripe Checkout supports server-created subscription sessions, metadata, and a success URL for returning users to the app. citeturn227500search0turn227500search1
