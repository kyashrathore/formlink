# FormCraft Preview Mode: iframe + postMessage Implementation Plan v1

## Executive Summary

This document provides a revised implementation plan for adding preview mode functionality to FormCraft using the **iframe with postMessage** approach. This solution extends the existing `RealEmbedPreview` pattern already working in the Share tab.

**Key Insight**: The Share tab already successfully renders the FormFiller app in an iframe. We extend this proven pattern for the Form tab preview mode.

## Why iframe + postMessage is Superior

### Problems with Component Sharing Approach

- ❌ **API Proxy Complexity**: Unnecessary middleware layer
- ❌ **Dependency Tangling**: Shared packages create version conflicts
- ❌ **Preview Drift**: Shared components may not match real FormFiller exactly
- ❌ **Maintenance Burden**: Transform layer requires constant updates
- ❌ **Tight Coupling**: Apps become joined at the hip

### Benefits of iframe + postMessage

- ✅ **100% Fidelity**: Uses actual FormFiller app - perfect preview accuracy
- ✅ **Total Decoupling**: Apps remain independent with simple contract
- ✅ **Proven Pattern**: Extends existing RealEmbedPreview implementation
- ✅ **Real-time Updates**: postMessage is instantaneous, no network latency
- ✅ **Simple Error Handling**: Isolated failures, graceful degradation
- ✅ **Security**: Standard cross-origin communication with origin validation

## Implementation Strategy

### Phase 1: Create FormFiller Preview Route

#### Step 1.1: Add Preview Route to FormFiller

```typescript
// apps/formfiller/app/preview/[formId]/page.tsx
"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import TypeFormView from '@/components/typeform/TypeFormView'
import { FormSchema } from '@formlink/schema'

export default function PreviewPage() {
  const { formId } = useParams()
  const [formData, setFormData] = useState<FormSchema | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Environment-aware origin validation
  const getAllowedOrigins = () => {
    const origins = process.env.NEXT_PUBLIC_ALLOWED_PREVIEW_ORIGINS
    return origins ? origins.split(',') : ['http://localhost:3000']
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const allowedOrigins = getAllowedOrigins()

      // Security: Validate origin
      if (!allowedOrigins.includes(event.origin)) {
        console.warn(`Preview: Message from untrusted origin ${event.origin} blocked`)
        return
      }

      // Handle form data updates
      if (event.data && event.data.type === 'FORMCRAFT_FORM_UPDATE') {
        console.log('Preview: Received form update:', event.data.payload)
        setFormData(event.data.payload)
      }
    }

    window.addEventListener('message', handleMessage)

    // Signal to parent that preview is ready
    const notifyReady = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: 'FORMFILLER_PREVIEW_READY', formId },
          '*' // Parent will validate this
        )
        setIsReady(true)
      }
    }

    // Notify ready after a short delay to ensure parent is listening
    const timer = setTimeout(notifyReady, 100)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(timer)
    }
  }, [formId])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-muted-foreground">Loading preview...</div>
        </div>
      </div>
    )
  }

  if (!formData) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="text-muted-foreground">Waiting for form data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <TypeFormView
        form={formData}
        isPreview={true}
        onSubmit={() => {
          console.log('Preview mode - submission blocked')
        }}
      />
    </div>
  )
}
```

#### Step 1.2: Environment Configuration

```bash
# apps/formfiller/.env.local
NEXT_PUBLIC_ALLOWED_PREVIEW_ORIGINS=http://localhost:3000,https://app.formcraft.com

# apps/formfiller/.env.development
NEXT_PUBLIC_ALLOWED_PREVIEW_ORIGINS=http://localhost:3000

# apps/formfiller/.env.production
NEXT_PUBLIC_ALLOWED_PREVIEW_ORIGINS=https://app.formcraft.com
```

### Phase 2: Create FormPreview Component

#### Step 2.1: FormPreview Component

```typescript
// apps/formcraft/app/test-ui/components/form/FormPreview.tsx
"use client"

import { useRef, useEffect, useState, useMemo } from 'react'
import { FormSchema } from '@formlink/schema'
import { DevicePreviewFrame } from './DevicePreviewFrame'
import { debounce } from 'lodash'

type DeviceMode = 'mobile' | 'tablet' | 'desktop'

interface FormPreviewProps {
  formId: string
  deviceMode: DeviceMode
  formData: FormSchema | null
}

export function FormPreview({ formId, deviceMode, formData }: FormPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  // Get FormFiller base URL from environment
  const getFormFillerUrl = () => {
    return process.env.NEXT_PUBLIC_FORMFILLER_BASE_URL || 'http://localhost:3001'
  }

  // Debounced function to send form updates
  const sendFormUpdate = useMemo(
    () => debounce((data: FormSchema) => {
      if (iframeRef.current?.contentWindow && previewStatus === 'ready') {
        const message = {
          type: 'FORMCRAFT_FORM_UPDATE',
          payload: data
        }

        iframeRef.current.contentWindow.postMessage(
          message,
          getFormFillerUrl()
        )
      }
    }, 250), // 250ms debounce for real-time updates
    [previewStatus]
  )

  // Send form updates when formData changes
  useEffect(() => {
    if (formData && previewStatus === 'ready') {
      sendFormUpdate(formData)
    }
  }, [formData, previewStatus, sendFormUpdate])

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      if (event.origin !== getFormFillerUrl()) {
        return
      }

      if (event.data?.type === 'FORMFILLER_PREVIEW_READY') {
        console.log('FormPreview: Preview iframe ready')
        setPreviewStatus('ready')
        setError(null)

        // Send initial form data if available
        if (formData) {
          sendFormUpdate(formData)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [formData, sendFormUpdate])

  // Handle iframe load errors
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      console.log('FormPreview: iframe loaded')
      // Set a timeout in case the ready message never comes
      setTimeout(() => {
        if (previewStatus === 'loading') {
          setPreviewStatus('error')
          setError('Preview failed to initialize')
        }
      }, 5000)
    }

    const handleError = () => {
      console.error('FormPreview: iframe load error')
      setPreviewStatus('error')
      setError('Failed to load preview')
    }

    iframe.addEventListener('load', handleLoad)
    iframe.addEventListener('error', handleError)

    return () => {
      iframe.removeEventListener('load', handleLoad)
      iframe.removeEventListener('error', handleError)
    }
  }, [previewStatus])

  const handleRetry = () => {
    setPreviewStatus('loading')
    setError(null)

    // Force iframe reload
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src
      iframeRef.current.src = ''
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc
        }
      }, 100)
    }
  }

  const previewUrl = `${getFormFillerUrl()}/preview/${formId}`

  return (
    <DevicePreviewFrame deviceMode={deviceMode}>
      {previewStatus === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <div className="text-sm text-muted-foreground">Loading preview...</div>
          </div>
        </div>
      )}

      {previewStatus === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <div className="text-red-500 mb-2">Preview Error</div>
            <div className="text-sm text-muted-foreground mb-4">
              {error || 'Failed to load preview'}
            </div>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={previewUrl}
        className="w-full h-full border-0"
        title="Form Preview"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </DevicePreviewFrame>
  )
}
```

#### Step 2.2: Device Preview Frame

```typescript
// apps/formcraft/app/test-ui/components/form/DevicePreviewFrame.tsx
"use client"

import { ReactNode } from 'react'

type DeviceMode = 'mobile' | 'tablet' | 'desktop'

interface DevicePreviewFrameProps {
  deviceMode: DeviceMode
  children: ReactNode
}

const deviceDimensions = {
  mobile: { width: 375, height: 812, name: 'Mobile' },
  tablet: { width: 768, height: 1024, name: 'Tablet' },
  desktop: { width: 1200, height: 800, name: 'Desktop' }
}

export function DevicePreviewFrame({ deviceMode, children }: DevicePreviewFrameProps) {
  const device = deviceDimensions[deviceMode]

  return (
    <div className="flex flex-col h-full bg-muted/5">
      {/* Device indicator */}
      <div className="flex items-center justify-center py-2 border-b border-border/30">
        <div className="text-xs text-muted-foreground">
          {device.name} Preview ({device.width}×{device.height})
        </div>
      </div>

      {/* Device frame */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div
          className="relative bg-background border border-border rounded-lg shadow-lg overflow-hidden"
          style={{
            width: Math.min(device.width, window.innerWidth - 32),
            height: Math.min(device.height, window.innerHeight - 120),
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
```

#### Step 2.3: Preview Controls

```typescript
// apps/formcraft/app/test-ui/components/form/PreviewControls.tsx
"use client"

import { Smartphone, Tablet, Monitor } from 'lucide-react'
import { Button } from '@formlink/ui'

type DeviceMode = 'mobile' | 'tablet' | 'desktop'

interface PreviewControlsProps {
  deviceMode: DeviceMode
  onDeviceChange: (mode: DeviceMode) => void
}

export function PreviewControls({ deviceMode, onDeviceChange }: PreviewControlsProps) {
  return (
    <div className="flex items-center space-x-1">
      <Button
        variant={deviceMode === 'mobile' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onDeviceChange('mobile')}
        className="px-2"
      >
        <Smartphone className="w-4 h-4" />
      </Button>
      <Button
        variant={deviceMode === 'tablet' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onDeviceChange('tablet')}
        className="px-2"
      >
        <Tablet className="w-4 h-4" />
      </Button>
      <Button
        variant={deviceMode === 'desktop' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onDeviceChange('desktop')}
        className="px-2"
      >
        <Monitor className="w-4 h-4" />
      </Button>
    </div>
  )
}
```

### Phase 3: Enhanced FormTabContent

#### Step 3.1: Updated FormTabContent

```typescript
// apps/formcraft/app/test-ui/components/FormTabContent.tsx
"use client"

import { useState } from 'react'
import { FileText, Eye, Edit } from "lucide-react"
import { Button } from "@formlink/ui"
import { useFormStore } from "../stores/useFormStore"
import FormEditor from "./form/FormEditor"
import { FormPreview } from "./form/FormPreview"
import { PreviewControls } from "./form/PreviewControls"

type DeviceMode = 'mobile' | 'tablet' | 'desktop'

const mockUser = {
  id: "test-user-id",
}

interface FormTabContentProps {
  formId: string
}

export default function FormTabContent({ formId }: FormTabContentProps) {
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit')
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop')
  const { form } = useFormStore()

  // Only show preview toggle if form has content
  const hasFormContent = form && form.questions && form.questions.length > 0

  if (!form) {
    return (
      <div className="bg-background flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md space-y-6 text-center">
            <div className="bg-primary/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <FileText className="text-primary h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-foreground text-2xl font-semibold">
                Start in Chat
              </h2>
              <p className="text-muted-foreground">
                Use the chat panel to describe your form. The AI will help you
                build it step by step, and changes will appear here in
                real-time.
              </p>
            </div>
            <div className="text-muted-foreground bg-muted/50 rounded-lg p-4 text-sm">
              💡 Try: "Create a contact form with name, email, and message
              fields"
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      {/* Enhanced Header */}
      <div className="bg-card/50 border-border/50 flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center space-x-2">
          <FileText className="text-muted-foreground h-4 w-4" />
          <span className="text-foreground text-sm font-medium">
            {previewMode === 'edit' ? 'Form Builder' : 'Form Preview'}
          </span>

          {hasFormContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode(prev => prev === 'edit' ? 'preview' : 'edit')}
            >
              {previewMode === 'edit' ? <Eye className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
              {previewMode === 'edit' ? 'Preview' : 'Edit'}
            </Button>
          )}
        </div>

        {previewMode === 'preview' && hasFormContent && (
          <PreviewControls
            deviceMode={deviceMode}
            onDeviceChange={setDeviceMode}
          />
        )}

        <div className="text-muted-foreground text-xs">
          Real-time updates enabled
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {previewMode === 'edit' ? (
          <div className="h-full overflow-auto p-4">
            <FormEditor user={mockUser} selectedTab="form" />
          </div>
        ) : (
          <FormPreview
            formId={formId}
            deviceMode={deviceMode}
            formData={form}
          />
        )}
      </div>
    </div>
  )
}
```

### Phase 4: Environment Configuration

#### Step 4.1: FormCraft Environment Setup

```bash
# apps/formcraft/.env.local
NEXT_PUBLIC_FORMFILLER_BASE_URL=http://localhost:3001

# apps/formcraft/.env.development
NEXT_PUBLIC_FORMFILLER_BASE_URL=http://localhost:3001

# apps/formcraft/.env.production
NEXT_PUBLIC_FORMFILLER_BASE_URL=https://formfiller.yourapp.com
```

## Success Criteria

### Phase 1 Success

- [ ] FormFiller preview route loads and displays waiting state
- [ ] postMessage communication established between apps
- [ ] Origin validation working in development and production

### Phase 2 Success

- [ ] FormPreview component loads FormFiller in iframe
- [ ] Real-time form updates sent via postMessage with debouncing
- [ ] Device preview modes working (mobile/tablet/desktop)
- [ ] Error handling and retry functionality working

### Phase 3 Success

- [ ] Preview toggle integrated into FormTabContent
- [ ] Seamless switching between edit and preview modes
- [ ] Device controls appear only in preview mode
- [ ] Form changes immediately reflected in preview

### Phase 4 Success

- [ ] Environment-based configuration working
- [ ] Production deployment successful
- [ ] Security validation working across environments

## Benefits of This Implementation

1. **Extends Existing Pattern**: Builds on proven RealEmbedPreview implementation
2. **100% Fidelity**: Uses actual FormFiller app for perfect preview accuracy
3. **Real-time Updates**: Debounced postMessage for smooth real-time editing
4. **Device Preview**: True responsive preview with device frames
5. **Robust Error Handling**: Graceful degradation and retry functionality
6. **Independent Deployment**: Apps remain decoupled and deployable separately
7. **Security**: Proper origin validation for cross-origin communication

## Risk Mitigation

1. **Network Dependency**: Initial iframe load requires network, but updates are local
2. **Cross-Origin Issues**: Solved with environment-based origin validation
3. **Error Handling**: Comprehensive error states and retry mechanisms
4. **Performance**: Debounced updates prevent excessive re-renders

This implementation provides a robust, maintainable solution that leverages existing patterns while delivering the preview functionality you need.
