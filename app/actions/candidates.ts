"use server";

import { revalidatePath } from "next/cache";
import { supabase, fetchWithCache, invalidateCache } from "@/lib/supabase";
import fs from "fs";
import path from "path";

export interface CandidateDto {
  id: string;
  postId: string;
  fullName: string;
  nickname?: string;
  matricNo?: string;
  photoUrl?: string;
  manifesto?: string;
  status: "NOMINATED" | "CLEARED" | "DISQUALIFIED";
  voteCount: number;
}

export interface PostWithCandidatesDto {
  id: string;
  electionId: string;
  title: string;
  description?: string;
  maxSelections: number;
  allowedLevels: number[];
  candidates: CandidateDto[];
}

import { getDataDir, safeReadDataJson, safeWriteDataJson } from "@/lib/data-dir";

function getInitialStore() {
  return {
    posts: [
      {
        id: "post-1",
        electionId: "elec-ui-2026",
        title: "President",
        description: "Executive President of the Association",
        maxSelections: 1,
        allowedLevels: [],
        candidates: [],
      },
      {
        id: "post-2",
        electionId: "elec-ui-2026",
        title: "Vice President",
        description: "Executive Vice President",
        maxSelections: 1,
        allowedLevels: [],
        candidates: [],
      },
      {
        id: "post-3",
        electionId: "elec-ui-2026",
        title: "General Secretary",
        description: "Chief Secretariat Administrator",
        maxSelections: 1,
        allowedLevels: [],
        candidates: [],
      },
    ],
  };
}

function readServerStore(): { posts: PostWithCandidatesDto[] } {
  try {
    return safeReadDataJson<{ posts: PostWithCandidatesDto[] }>(
      "candidates-store.json",
      getInitialStore()
    );
  } catch (err) {
    console.warn("readServerStore error, returning initial:", err);
    return getInitialStore();
  }
}

function writeServerStore(store: { posts: PostWithCandidatesDto[] }) {
  try {
    safeWriteDataJson("candidates-store.json", store);
  } catch (err) {
    console.warn("writeServerStore error:", err);
  }
}

/**
 * Fetch all posts and candidates for an election
 */
export async function getElectionPostsAndCandidatesAction(
  electionId: string
): Promise<PostWithCandidatesDto[]> {
  const targetElectionId = electionId || "elec-ui-nesa-2026";

  return fetchWithCache(`posts:${targetElectionId}`, 15, async () => {
    try {
      const store = readServerStore();

      // 1. Attempt querying Supabase posts & candidates
      try {
        let { data: cloudPosts } = await supabase
          .from("posts")
          .select("*")
          .eq("election_id", targetElectionId)
          .order("display_order", { ascending: true });

        // If no posts found under exact electionId, check if this election belongs to an org
        // that has posts under an alias/legacy election ID (e.g. elec-renarsa-1789935219921 vs elec-ui-renarsa-2026)
        if (!cloudPosts || cloudPosts.length === 0) {
          const { data: elecData } = await supabase
            .from("elections")
            .select("organization_id")
            .eq("id", targetElectionId)
            .maybeSingle();

          if (elecData?.organization_id) {
            const { data: relatedElecs } = await supabase
              .from("elections")
              .select("id")
              .eq("organization_id", elecData.organization_id);

            const aliasIds = (relatedElecs || [])
              .map((e: any) => e.id)
              .filter((id: string) => id && id !== targetElectionId);

            if (aliasIds.length > 0) {
              const { data: aliasPosts } = await supabase
                .from("posts")
                .select("*")
                .in("election_id", aliasIds)
                .order("display_order", { ascending: true });

              if (aliasPosts && aliasPosts.length > 0) {
                cloudPosts = aliasPosts;
              }
            }
          }
        }

        // STRICT ISOLATION: if no posts exist for this exact electionId or its org aliases,
        // fall back to local store posts
        if (!cloudPosts || cloudPosts.length === 0) {
          const matchingStorePosts = store.posts.filter(
            (p) => p.electionId === targetElectionId
          );
          if (matchingStorePosts.length === 0) {
            // Do not hold empty result in cache
            invalidateCache(`posts:${targetElectionId}`);
          }
          return matchingStorePosts;
        }

        // 2. Query candidates SCOPED to this election's posts only
        const postIds = cloudPosts.map((p: any) => p.id);
        const { data: cloudCandidates } = await supabase
          .from("candidates")
          .select("*")
          .in("post_id", postIds)
          .order("created_at", { ascending: true });

        if (cloudPosts && cloudPosts.length > 0) {
          const cloudMerged: PostWithCandidatesDto[] = cloudPosts.map((p: any) => {
            const postCloudCands: CandidateDto[] = (cloudCandidates || [])
              .filter((c: any) => (c.post_id || c.postId) === p.id)
              .map((c: any) => ({
                id: c.id,
                postId: p.id,
                fullName: c.full_name || c.fullName,
                nickname: c.nickname || "",
                matricNo: c.matric_no || c.matricNo || "",
                photoUrl: c.photo_url || c.photoUrl || "",
                manifesto: c.manifesto || "",
                status: (c.status || "CLEARED") as "NOMINATED" | "CLEARED" | "DISQUALIFIED",
                voteCount: c.vote_count || 0,
              }));

            // Also include any candidate from local store if not yet in Supabase
            const storePost = store.posts.find((sp) => sp.id === p.id && (sp.electionId === targetElectionId || sp.electionId === p.election_id));
            if (storePost?.candidates) {
              const existingIds = new Set(postCloudCands.map((c) => c.id));
              for (const sc of storePost.candidates) {
                if (!existingIds.has(sc.id)) {
                  postCloudCands.push(sc);
                }
              }
            }

            return {
              id: p.id,
              electionId: p.election_id || targetElectionId,
              title: p.title,
              description: p.description || "",
              maxSelections: p.max_selections || 1,
              allowedLevels: p.allowed_levels || [],
              candidates: postCloudCands,
            };
          });

          return cloudMerged;
        }
      } catch (cloudErr) {
        console.warn("Cloud posts query exception, using local store:", cloudErr);
      }

      // Strict local store fallback: only return posts matching this specific electionId
      const matchingStorePosts = store.posts.filter(
        (p) => p.electionId === targetElectionId
      );
      if (matchingStorePosts.length === 0) {
        invalidateCache(`posts:${targetElectionId}`);
      }
      return matchingStorePosts;
    } catch (err) {
      console.warn("Error in getElectionPostsAndCandidatesAction:", err);
      return [];
    }
  });
}

/**
 * Add a new Elective Office/Post
 */
export async function createPostAction(input: {
  electionId: string;
  title: string;
  description?: string;
  maxSelections?: number;
  allowedLevels?: number[];
}) {
  const newPostId = `post-${Date.now()}`;
  const store = readServerStore();

  let targetElectionId = input.electionId || "elec-ui-nesa-2026";
  try {
    const { data: elec } = await supabase
      .from("elections")
      .select("id, organization_id")
      .eq("id", targetElectionId)
      .maybeSingle();

    if (!elec) {
      // Ensure the election record exists so foreign key constraints on `posts.election_id` succeed
      const match = targetElectionId.match(/^elec-([^-]+)-([^-]+)-2026$/);
      const instSlug = match ? match[1] : "ui";
      const orgSlug = match ? match[2] : "nesa";
      const orgId = `org-${instSlug}-${orgSlug}`;

      await supabase.from("elections").upsert({
        id: targetElectionId,
        organization_id: orgId,
        title: `${orgSlug.toUpperCase()} Elections 2026`,
        academic_session: "2025/2026",
        description: "",
        status: "LIVE",
        results_visibility: "LIVE",
        auth_mode: "PIN_SLIP",
      });
    }
  } catch (err) {
    console.warn("createPostAction: election ensure warning:", err);
  }

  const newPost: PostWithCandidatesDto = {
    id: newPostId,
    electionId: targetElectionId,
    title: input.title.trim(),
    description: input.description?.trim() || "",
    maxSelections: input.maxSelections || 1,
    allowedLevels: input.allowedLevels || [],
    candidates: [],
  };

  store.posts.push(newPost);
  writeServerStore(store);

  try {
    const { error: postError } = await supabase.from("posts").upsert({
      id: newPostId,
      election_id: targetElectionId,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      max_selections: input.maxSelections || 1,
      display_order: Date.now() % 100000,
      allowed_levels: input.allowedLevels || [],
      allowed_departments: [],
    });
    if (postError) {
      console.error("createPostAction Supabase error:", postError);
    }
  } catch (err) {
    console.error("createPostAction exception:", err);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  try {
    const { invalidateTelemetryCacheAction } = await import("./vote");
    await invalidateTelemetryCacheAction(targetElectionId);
  } catch (_) {}

  return {
    success: true,
    postId: newPostId,
    message: `Elective post "${input.title}" added successfully.`,
  };
}

/**
 * Add / Nominate a Candidate with Photo
 */
export async function createCandidateAction(input: {
  candidateId?: string;
  postId: string;
  fullName: string;
  nickname?: string;
  matricNo?: string;
  photoUrl?: string;
  manifesto?: string;
  electionId?: string;
}) {
  const newCandId = input.candidateId || `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const store = readServerStore();
  let targetElectionId = input.electionId || "elec-ui-nesa-2026";

  // 1. Immediately update local server store backup (0ms synchronous disk write)
  const newCand: CandidateDto = {
    id: newCandId,
    postId: input.postId,
    fullName: input.fullName.trim(),
    nickname: input.nickname?.trim() || "",
    matricNo: input.matricNo?.trim() || "",
    photoUrl: input.photoUrl?.trim() || "",
    manifesto: input.manifesto?.trim() || "",
    status: "CLEARED",
    voteCount: 0,
  };

  let foundPost = false;
  store.posts = store.posts.map((post) => {
    if (post.id === input.postId) {
      foundPost = true;
      return {
        ...post,
        candidates: [...post.candidates.filter((c) => c.id !== newCandId), newCand],
      };
    }
    return post;
  });

  if (!foundPost) {
    store.posts.push({
      id: input.postId,
      electionId: targetElectionId,
      title: "Executive Office",
      description: "",
      maxSelections: 1,
      allowedLevels: [],
      candidates: [newCand],
    });
  }

  writeServerStore(store);

  // 2. Persist candidate directly to Supabase cloud (fast single-call upsert)
  try {
    const { error: candError } = await supabase.from("candidates").upsert({
      id: newCandId,
      post_id: input.postId,
      full_name: input.fullName.trim(),
      nickname: input.nickname?.trim() || "",
      matric_no: input.matricNo?.trim() || "",
      photo_url: input.photoUrl?.trim() || "",
      manifesto: input.manifesto?.trim() || "",
      status: "CLEARED",
      vote_count: 0,
    });

    // If foreign key constraint failed because the post row isn't in Supabase yet, create post and retry
    if (candError) {
      const foundInStore = store.posts.find((p) => p.id === input.postId);
      const postTitle =
        foundInStore?.title ||
        (input.postId === "post-1"
          ? "President"
          : input.postId === "post-2"
          ? "Vice President"
          : input.postId === "post-3"
          ? "General Secretary"
          : "Executive Office");

      await supabase.from("posts").upsert({
        id: input.postId,
        election_id: targetElectionId,
        title: postTitle,
        description: foundInStore?.description || "",
        max_selections: 1,
        display_order: 1,
        allowed_levels: [],
        allowed_departments: [],
      });

      await supabase.from("candidates").upsert({
        id: newCandId,
        post_id: input.postId,
        full_name: input.fullName.trim(),
        nickname: input.nickname?.trim() || "",
        matric_no: input.matricNo?.trim() || "",
        photo_url: input.photoUrl?.trim() || "",
        manifesto: input.manifesto?.trim() || "",
        status: "CLEARED",
        vote_count: 0,
      });
    }
  } catch (candInsertErr) {
    console.warn("createCandidateAction background insert notice:", candInsertErr);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  try {
    const { invalidateTelemetryCacheAction } = await import("./vote");
    await invalidateTelemetryCacheAction(targetElectionId);
  } catch (_) {}

  return {
    success: true,
    candidateId: newCandId,
    message: `Candidate "${input.fullName}" successfully registered.`,
  };
}

/**
 * Update / Edit a Candidate's details
 */
export async function updateCandidateAction(input: {
  candidateId: string;
  fullName: string;
  nickname?: string;
  matricNo?: string;
  photoUrl?: string;
  manifesto?: string;
  status?: "NOMINATED" | "CLEARED" | "DISQUALIFIED";
}) {
  const store = readServerStore();

  store.posts = store.posts.map((post) => ({
    ...post,
    candidates: post.candidates.map((c) =>
      c.id === input.candidateId
        ? {
            ...c,
            fullName: input.fullName.trim(),
            nickname: input.nickname?.trim() || "",
            matricNo: input.matricNo?.trim() || "",
            photoUrl: input.photoUrl?.trim() || "",
            manifesto: input.manifesto?.trim() || "",
            status: input.status || "CLEARED",
          }
        : c
    ),
  }));

  writeServerStore(store);

  try {
    const { error } = await supabase
      .from("candidates")
      .update({
        full_name: input.fullName.trim(),
        nickname: input.nickname?.trim() || "",
        matric_no: input.matricNo?.trim() || "",
        photo_url: input.photoUrl?.trim() || "",
        manifesto: input.manifesto?.trim() || "",
        status: input.status || "CLEARED",
      })
      .eq("id", input.candidateId);

    if (error) {
      console.error("updateCandidateAction Supabase error:", error);
    }
  } catch (err) {
    console.error("updateCandidateAction exception:", err);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");
  return {
    success: true,
    message: `Candidate profile updated successfully.`,
  };
}

/**
 * Delete / Disqualify a candidate
 */
export async function deleteCandidateAction(candidateId: string) {
  const store = readServerStore();

  store.posts = store.posts.map((post) => ({
    ...post,
    candidates: post.candidates.filter((c) => c.id !== candidateId),
  }));

  writeServerStore(store);

  try {
    const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
    if (error) {
      console.error("deleteCandidateAction Supabase error:", error);
    }
  } catch (err) {
    console.error("deleteCandidateAction exception:", err);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  try {
    const { invalidateTelemetryCacheAction } = await import("./vote");
    await invalidateTelemetryCacheAction();
  } catch (_) {}
  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");
  return { success: true, message: "Candidate removed." };
}

/**
 * Delete a post
 */
export async function deletePostAction(postId: string) {
  const store = readServerStore();

  store.posts = store.posts.filter((p) => p.id !== postId);
  writeServerStore(store);

  try {
    await supabase.from("candidates").delete().eq("post_id", postId);
    await supabase.from("posts").delete().eq("id", postId);
  } catch (err) {
    console.error("deletePostAction exception:", err);
  }

  invalidateCache("posts:");
  invalidateCache("telemetry:");
  try {
    const { invalidateTelemetryCacheAction } = await import("./vote");
    await invalidateTelemetryCacheAction();
  } catch (_) {}
  return { success: true, message: "Elective post removed." };
}

/**
 * Update an existing Elective Office/Post (Title, Description, and Single vs Multiple Selection)
 */
export async function updatePostAction(input: {
  postId: string;
  electionId?: string;
  title: string;
  description?: string;
  maxSelections?: number;
  allowedLevels?: number[];
}): Promise<{
  success: boolean;
  message: string;
  post?: PostWithCandidatesDto;
}> {
  const store = readServerStore();
  const cleanTitle = input.title.trim();
  const cleanDesc = input.description?.trim() || "";
  const maxSel = Math.max(1, Number(input.maxSelections) || 1);

  let updatedPost: PostWithCandidatesDto | undefined;

  store.posts = store.posts.map((post) => {
    if (post.id === input.postId) {
      updatedPost = {
        ...post,
        title: cleanTitle,
        description: cleanDesc,
        maxSelections: maxSel,
        allowedLevels: input.allowedLevels !== undefined ? input.allowedLevels : post.allowedLevels,
      };
      return updatedPost;
    }
    return post;
  });

  writeServerStore(store);

  try {
    const updatePayload: any = {
      title: cleanTitle,
      description: cleanDesc,
      max_selections: maxSel,
    };
    if (input.allowedLevels !== undefined) {
      updatePayload.allowed_levels = input.allowedLevels;
    }

    const { error } = await supabase
      .from("posts")
      .update(updatePayload)
      .eq("id", input.postId);

    if (error) {
      console.warn("updatePostAction Supabase update notice:", error);
    }
  } catch (err) {
    console.warn("updatePostAction exception:", err);
  }

  const targetElectionId = input.electionId || updatedPost?.electionId || "elec-ui-nesa-2026";
  invalidateCache("posts:");
  invalidateCache("telemetry:");
  try {
    const { invalidateTelemetryCacheAction } = await import("./vote");
    await invalidateTelemetryCacheAction(targetElectionId);
  } catch (_) {}

  revalidatePath("/[institution]/admin");
  revalidatePath("/[institution]/[organization]");

  return {
    success: true,
    message: `Elective office "${cleanTitle}" updated successfully.`,
    post: updatedPost,
  };
}

/**
 * Bulk create elective offices and candidates in a single high-speed batch operation
 */
export async function bulkCreateSlateAction(input: {
  electionId: string;
  posts: Array<{
    id?: string;
    title: string;
    description?: string;
    maxSelections?: number;
    allowedLevels?: number[];
    candidates?: Array<{
      id?: string;
      fullName: string;
      nickname?: string;
      matricNo?: string;
      photoUrl?: string;
      manifesto?: string;
    }>;
  }>;
}): Promise<{
  success: boolean;
  postsCreated: number;
  candidatesCreated: number;
  message: string;
  posts?: PostWithCandidatesDto[];
}> {
  try {
    const targetElectionId = input.electionId || "elec-ui-nesa-2026";
    const store = readServerStore();

    let postsCreated = 0;
    let candidatesCreated = 0;

    const cloudPostsToInsert: any[] = [];
    const cloudCandidatesToInsert: any[] = [];

    const now = Date.now();

    for (let i = 0; i < input.posts.length; i++) {
      const p = input.posts[i];
      if (!p.title?.trim()) continue;

      const postId = p.id || `post-${now}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      const cleanTitle = p.title.trim();
      const cleanDesc = p.description?.trim() || "";
      const maxSel = p.maxSelections || 1;
      const levels = p.allowedLevels || [];

      // Check if post already exists in store by title or id
      let existingPost = store.posts.find(
        (sp) =>
          (sp.electionId === targetElectionId || !sp.electionId) &&
          (sp.id === postId || sp.title.toLowerCase() === cleanTitle.toLowerCase())
      );

      const resolvedPostId = existingPost ? existingPost.id : postId;

      if (!existingPost) {
        existingPost = {
          id: resolvedPostId,
          electionId: targetElectionId,
          title: cleanTitle,
          description: cleanDesc,
          maxSelections: maxSel,
          allowedLevels: levels,
          candidates: [],
        };
        store.posts.push(existingPost);
        postsCreated++;

        cloudPostsToInsert.push({
          id: resolvedPostId,
          election_id: targetElectionId,
          title: cleanTitle,
          description: cleanDesc,
          max_selections: maxSel,
          display_order: i + 1,
          allowed_levels: levels,
          allowed_departments: [],
        });
      }

      if (Array.isArray(p.candidates)) {
        for (let j = 0; j < p.candidates.length; j++) {
          const c = p.candidates[j];
          if (!c.fullName?.trim()) continue;

          const candId = c.id || `cand-${now}-${i}-${j}-${Math.random().toString(36).substring(2, 6)}`;
          const cleanName = c.fullName.trim();
          const cleanNick = c.nickname?.trim() || "";
          const cleanMatric = c.matricNo?.trim() || "";
          const cleanPhoto = c.photoUrl?.trim() || "";
          const cleanManifesto = c.manifesto?.trim() || "";

          // Avoid duplicating candidates in same post
          const candExists = existingPost.candidates.some(
            (sc) =>
              sc.fullName.toLowerCase() === cleanName.toLowerCase() ||
              (cleanMatric && sc.matricNo === cleanMatric)
          );

          if (!candExists) {
            const newCand: CandidateDto = {
              id: candId,
              postId: resolvedPostId,
              fullName: cleanName,
              nickname: cleanNick,
              matricNo: cleanMatric,
              photoUrl: cleanPhoto,
              manifesto: cleanManifesto,
              status: "CLEARED",
              voteCount: 0,
            };
            existingPost.candidates.push(newCand);
            candidatesCreated++;

            cloudCandidatesToInsert.push({
              id: candId,
              post_id: resolvedPostId,
              full_name: cleanName,
              nickname: cleanNick,
              matric_no: cleanMatric,
              photo_url: cleanPhoto,
              manifesto: cleanManifesto,
              status: "CLEARED",
              vote_count: 0,
            });
          }
        }
      }
    }

    // 1. Write store to disk
    writeServerStore(store);

    // 2. Batch write to Supabase cloud in parallel
    const dbPromises: Promise<any>[] = [];
    if (cloudPostsToInsert.length > 0) {
      dbPromises.push(supabase.from("posts").upsert(cloudPostsToInsert));
    }
    if (cloudCandidatesToInsert.length > 0) {
      dbPromises.push(supabase.from("candidates").upsert(cloudCandidatesToInsert));
    }

    try {
      await Promise.allSettled(dbPromises);
    } catch (dbErr) {
      console.warn("bulkCreateSlateAction cloud insert notice:", dbErr);
    }

    // 3. Clear cache
    invalidateCache("posts:");
    invalidateCache("telemetry:");
    try {
      const { invalidateTelemetryCacheAction } = await import("./vote");
      await invalidateTelemetryCacheAction(targetElectionId);
    } catch (_) {}

    const matchingPosts = store.posts.filter((p) => p.electionId === targetElectionId);

    return {
      success: true,
      postsCreated,
      candidatesCreated,
      message: `Batch complete: created ${postsCreated} elective ${postsCreated === 1 ? "office" : "offices"} and ${candidatesCreated} ${candidatesCreated === 1 ? "candidate" : "candidates"}.`,
      posts: matchingPosts,
    };
  } catch (err: any) {
    console.error("bulkCreateSlateAction error:", err);
    return {
      success: false,
      postsCreated: 0,
      candidatesCreated: 0,
      message: err.message || "Failed to batch create slate.",
    };
  }
}

