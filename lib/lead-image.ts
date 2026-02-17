import { getDataServiceUrl } from '@jazzmind/busibox-app/lib/data';
import { getAgentApiUrl } from '@/lib/agent-api-client';
import { getAppSettings, getProject, updateProject } from '@/lib/data-api-client';
import type { Project } from '@/lib/types';

export type ProjectDocumentIds = {
  projects: string;
  settings: string;
};

export type GenerateLeadImageParams = {
  dataApiToken: string;
  agentApiToken: string;
  projectId: string;
  documentIds: ProjectDocumentIds;
  styleInstructions?: string;
};

export async function generateAndSaveProjectLeadImage({
  dataApiToken,
  agentApiToken,
  projectId,
  documentIds,
  styleInstructions,
}: GenerateLeadImageParams): Promise<Project> {
  const project = await getProject(dataApiToken, documentIds.projects, projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const resolvedStyle = styleInstructions
    ?? (await getAppSettings(dataApiToken, documentIds.settings)).leadImageStyleInstructions;

  const prompt = buildLeadImagePrompt(project, resolvedStyle);

  const agentApiUrl = getAgentApiUrl();
  const imageResponse = await fetch(`${agentApiUrl}/llm/images/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentApiToken}`,
    },
    body: JSON.stringify({
      model: 'image',
      prompt,
      size: '1024x1024',
      n: 1,
    }),
  });

  if (!imageResponse.ok) {
    const errorText = await imageResponse.text();
    throw new Error(`Image generation failed: ${imageResponse.status} ${errorText}`);
  }

  const imageData = await imageResponse.json();
  const first = imageData?.data?.[0];
  if (!first) {
    throw new Error('No image data returned from generation');
  }

  let imageBytes: Buffer;
  let mimeType = 'image/png';

  if (first.b64_json) {
    imageBytes = Buffer.from(first.b64_json, 'base64');
  } else if (first.url) {
    const downloadResp = await fetch(first.url);
    if (!downloadResp.ok) {
      throw new Error('Failed to download generated image from provider');
    }
    const contentType = downloadResp.headers.get('content-type');
    if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
      mimeType = 'image/jpeg';
    } else if (contentType?.includes('webp')) {
      mimeType = 'image/webp';
    }
    imageBytes = Buffer.from(await downloadResp.arrayBuffer());
  } else {
    throw new Error('Image model returned no image data');
  }

  const dataApiUrl = getDataServiceUrl();
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  const filename = `project-lead-image.${ext}`;

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(imageBytes)], { type: mimeType }), filename);
  formData.append('visibility', 'personal');
  formData.append('metadata', JSON.stringify({
    source: 'project_lead_image',
    projectId,
    projectName: project.name,
    generated: true,
  }));

  const uploadResp = await fetch(`${dataApiUrl}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${dataApiToken}`,
    },
    body: formData,
  });

  if (!uploadResp.ok) {
    const errorText = await uploadResp.text();
    throw new Error(`Failed to store generated image: ${uploadResp.status} ${errorText}`);
  }

  const uploadData = await uploadResp.json();
  const fileId = uploadData.fileId;
  if (!fileId) {
    throw new Error('Upload succeeded but no fileId returned');
  }

  const mediaUrl = `/portal/api/media/${fileId}`;
  const updated = await updateProject(dataApiToken, documentIds.projects, projectId, {
    leadImage: mediaUrl,
  });

  if (!updated) {
    throw new Error('Project image update failed');
  }

  return updated;
}

function buildLeadImagePrompt(project: Project, styleInstructions: string): string {
  const projectContext = [project.name, project.description].filter(Boolean).join('. ');
  return [
    'Create a professional, modern, abstract illustration for a project dashboard.',
    `The image should visually represent the concept of: "${projectContext}".`,
    `Style instructions: ${styleInstructions}.`,
    'No text or words in the image.',
    'Suitable as a banner/hero image.',
  ].join(' ');
}
