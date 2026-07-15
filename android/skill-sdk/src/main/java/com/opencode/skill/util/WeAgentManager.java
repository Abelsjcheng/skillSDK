package com.opencode.skill.util;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.opencode.skill.callback.SkillCallback;
import com.opencode.skill.log.WeLinkLogger;
import com.opencode.skill.model.DeleteWeAgentResult;
import com.opencode.skill.model.WeAgentDetails;
import com.opencode.skill.model.WeAgentDetailsArrayResult;
import com.opencode.skill.model.WeAgentUriResult;
import com.opencode.skill.network.ApiClient;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/** Shared assistant detail, cache, and notification payload helpers. */
public final class WeAgentManager {
    private static final String TAG = "SkillSDK";
    private static final String WE_AGENT_EVENT_NAME = "agentskills.agentUpdated";

    @NonNull
    public static String getWeAgentEventName() {
        return WE_AGENT_EVENT_NAME;
    }

    @NonNull
    private final Gson gson;

    @NonNull
    private final ApiClient apiClient;

    @NonNull
    private final WeAgentStorage weAgentStorage;

    @NonNull
    private static final ArrayDeque<WeAgentCacheMutation> WE_AGENT_CACHE_MUTATION_QUEUE = new ArrayDeque<>();
    private static boolean processingWeAgentCacheMutation;
    private static int weAgentCacheMutationGeneration;

    public WeAgentManager(
            @NonNull Gson gson,
            @NonNull ApiClient apiClient,
            @NonNull WeAgentStorage weAgentStorage
    ) {
        this.gson = gson;
        this.apiClient = apiClient;
        this.weAgentStorage = weAgentStorage;
    }

    @NonNull
    public static WeAgentDetailsArrayResult resolveWeAgentDetailsResult(@Nullable WeAgentDetailsArrayResult result) {
        return result == null ? new WeAgentDetailsArrayResult() : result;
    }

    public void cacheWeAgentDetailsResult(
            @NonNull String partnerAccount,
            @NonNull WeAgentDetailsArrayResult result
    ) {
        cacheWeAgentDetailsResult(partnerAccount, result, true);
    }

    public void cacheWeAgentDetailsResult(
            @NonNull String partnerAccount,
            @NonNull WeAgentDetailsArrayResult result,
            boolean saveCurrentDetail
    ) {
        if (result.getWeAgentDetailsArray().isEmpty()) {
            return;
        }
        WeAgentDetails cachedDetail = result.getWeAgentDetailsArray().get(0);
        weAgentStorage.saveWeAgentDetails(partnerAccount, cachedDetail);
        if (saveCurrentDetail) {
            weAgentStorage.saveCurrentWeAgentDetail(cachedDetail);
        }
    }

    public void refreshAssistantDetailsCache(@NonNull String partnerAccount) {
        apiClient.getWeAgentDetails(partnerAccount, new SkillCallback<WeAgentDetailsArrayResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                cacheWeAgentDetailsResult(partnerAccount, resolveWeAgentDetailsResult(result), false);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // Ignore background refresh failures.
            }
        });
    }

    public void refreshAssistantGraySingleCache(@NonNull String partnerAccount) {
        apiClient.queryAssistantGraySingle(partnerAccount, new SkillCallback<Boolean>() {
            @Override
            public void onSuccess(@Nullable Boolean result) {
                if (result == null) {
                    return;
                }
                weAgentStorage.saveAssistantGraySingle(partnerAccount, result);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // Ignore async refresh failure and keep old cache.
            }
        });
    }

    /**
     * 在 SDK 冷启动时用服务端数据补偿本地助理缓存。
     *
     * <p>该方法合并详情缓存和当前助理中的账号后发起一次批量查询。服务端未返回的账号会从
     * 统一删除流程清理缓存、处理当前助理后续 URI 并广播删除事件；返回且与本地有差异的
     * 详情只覆盖已存在的缓存并广播更新事件。请求失败时保持本地状态不变。</p>
     */
    public void refreshWeAgentsOnColdStart() {
        enqueueWeAgentCacheMutation(this::performColdStartWeAgentRefresh);
    }

    private void performColdStartWeAgentRefresh(@NonNull SkillCallback<Void> completion) {
        List<String> partnerAccounts = weAgentStorage.getCachedWeAgentPartnerAccounts();
        if (partnerAccounts.isEmpty()) {
            WeLinkLogger.i(TAG, "cold-start we-agent refresh skipped: no cached partnerAccount");
            completion.onSuccess(null);
            return;
        }
        WeLinkLogger.i(TAG, "cold-start we-agent refresh started, accountCount=" + partnerAccounts.size());
        Map<String, WeAgentDetails> cachedDetails = weAgentStorage.loadWeAgentDetailsCache();
        WeAgentDetails currentDetail = weAgentStorage.getCurrentWeAgentDetail();
        apiClient.getWeAgentDetails(String.join(",", partnerAccounts), new SkillCallback<WeAgentDetailsArrayResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                WeAgentDetailsArrayResult resolved = resolveWeAgentDetailsResult(result);
                WeLinkLogger.i(TAG, "cold-start we-agent detail request succeeded, remoteCount="
                        + resolved.getWeAgentDetailsArray().size());
                Map<String, WeAgentDetails> remoteDetails = new HashMap<>();
                for (WeAgentDetails detail : resolved.getWeAgentDetailsArray()) {
                    String partnerAccount = SdkStringUtils.normalizeOptionalString(detail.getPartnerAccount());
                    if (partnerAccount != null) {
                        remoteDetails.put(partnerAccount, detail);
                    }
                }
                processColdStartWeAgentAccounts(
                        partnerAccounts,
                        remoteDetails,
                        cachedDetails,
                        currentDetail,
                        0,
                        completion
                );
            }

            @Override
            public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "cold-start we-agent detail request failed, error=" + error.getMessage());
                completion.onSuccess(null);
            }
        });
    }

    private void processColdStartWeAgentAccounts(
            @NonNull List<String> partnerAccounts,
            @NonNull Map<String, WeAgentDetails> remoteDetails,
            @NonNull Map<String, WeAgentDetails> cachedDetails,
            @Nullable WeAgentDetails currentDetail,
            int index,
            @NonNull SkillCallback<Void> completion
    ) {
        if (index >= partnerAccounts.size()) {
            WeLinkLogger.i(TAG, "cold-start we-agent refresh completed, accountCount=" + partnerAccounts.size());
            completion.onSuccess(null);
            return;
        }
        String partnerAccount = partnerAccounts.get(index);
        WeAgentDetails remoteDetail = remoteDetails.get(partnerAccount);
        if (remoteDetail == null) {
            WeLinkLogger.i(TAG, "cold-start detected deleted we-agent, partnerAccount=" + partnerAccount);
            handleDeletedWeAgent(
                    partnerAccount,
                    buildWeAgentData(partnerAccount),
                    "server",
                    continueColdStartProcessing(
                            partnerAccounts,
                            remoteDetails,
                            cachedDetails,
                            currentDetail,
                            index,
                            completion
                    )
            );
            return;
        }
        WeAgentDetails cachedDetail = cachedDetails.get(partnerAccount);
        boolean currentMatches = matchesWeAgentDetails(currentDetail, partnerAccount);
        boolean changed = cachedDetail != null && !detailsEqual(gson, cachedDetail, remoteDetail);
        changed = changed || currentMatches && !detailsEqual(gson, currentDetail, remoteDetail);
        if (changed) {
            WeLinkLogger.i(TAG, "cold-start detected updated we-agent, partnerAccount=" + partnerAccount);
            weAgentStorage.replaceCachedWeAgentDetailsIfPresent(partnerAccount, remoteDetail);
            dispatchHostBroadcast(
                    WE_AGENT_EVENT_NAME,
                    buildResolvedUpdatePayload(gson, remoteDetail, "server")
            );
        }
        processColdStartWeAgentAccounts(
                partnerAccounts,
                remoteDetails,
                cachedDetails,
                currentDetail,
                index + 1,
                completion
        );
    }

    @NonNull
    private SkillCallback<Void> continueColdStartProcessing(
            @NonNull List<String> partnerAccounts,
            @NonNull Map<String, WeAgentDetails> remoteDetails,
            @NonNull Map<String, WeAgentDetails> cachedDetails,
            @Nullable WeAgentDetails currentDetail,
            int index,
            @NonNull SkillCallback<Void> completion
    ) {
        return new SkillCallback<Void>() {
            @Override
            public void onSuccess(@Nullable Void ignored) {
                processColdStartWeAgentAccounts(
                        partnerAccounts,
                        remoteDetails,
                        cachedDetails,
                        currentDetail,
                        index + 1,
                        completion
                );
            }

            @Override
            public void onError(@NonNull Throwable error) {
                // A failed URI calculation must not block compensation for the remaining accounts.
                onSuccess(null);
            }
        };
    }

    /**
     * 比较两个助理详情对象的完整序列化内容是否一致，用于判断冷启动补偿是否需要写缓存和广播。
     */
    public static boolean detailsEqual(@NonNull Gson gson, @Nullable WeAgentDetails left, @Nullable WeAgentDetails right) {
        if (left == null || right == null) {
            return left == right;
        }
        return gson.toJsonTree(left).equals(gson.toJsonTree(right));
    }

    @NonNull
    /**
     * 将已补拉完成的完整助理详情转换为统一更新广播载荷。
     *
     * <p>详情对象先转换为通用 Map，再交给统一载荷构造方法补充事件类型和来源。</p>
     */
    public static Map<String, Object> buildResolvedUpdatePayload(
            @NonNull Gson gson,
            @NonNull WeAgentDetails detail,
            @NonNull String source
    ) {
        Map<String, Object> data = gson.fromJson(gson.toJson(detail), new TypeToken<Map<String, Object>>() {
        }.getType());
        return buildWeAgentPayload("update", data, source);
    }

    /**
     * 解析并执行助理更新或删除通知。
     *
     * <p>更新通知仅修改本地已存在详情的基础字段，随后补拉完整详情再广播；删除通知复用
     * 统一删除流程处理缓存、当前助理跳转和广播。缺少 action、weCrew 或必要账号时不继续处理。</p>
     */
    public void handleWeAgentNotifyData(
            @NonNull Map<String, Object> notifyData,
            @NonNull String source,
            @NonNull SkillCallback<Void> completion
    ) {
        String action = SdkStringUtils.normalizeOptionalString(TypeConvertUtils.valueAsString(notifyData.get("action")));
        Map<String, Object> weCrew = TypeConvertUtils.valueAsMap(gson, notifyData.get("weCrew"));
        if (action == null || weCrew == null) {
            WeLinkLogger.e(TAG, "ignore we-agent notification: action or weCrew is missing");
            completion.onSuccess(null);
            return;
        }
        String partnerAccount = SdkStringUtils.normalizeOptionalString(
                TypeConvertUtils.valueAsString(weCrew.get("partnerAccount"))
        );
        if ("update".equalsIgnoreCase(action)) {
            if (partnerAccount == null) {
                WeLinkLogger.e(TAG, "ignore we-agent update notification: partnerAccount is missing");
                completion.onSuccess(null);
                return;
            }
            WeLinkLogger.i(TAG, "process server we-agent update, partnerAccount=" + partnerAccount);
            updateCachedBasicFieldsIfPresent(weAgentStorage, partnerAccount, weCrew);
            broadcastWeAgentEvent(
                    WE_AGENT_EVENT_NAME,
                    buildWeAgentPayload("update", weCrew, source),
                    completion
            );
            return;
        }
        if ("delete".equalsIgnoreCase(action)) {
            if (partnerAccount == null) {
                WeLinkLogger.e(TAG, "ignore we-agent delete notification: partnerAccount is missing");
                completion.onSuccess(null);
                return;
            }
            WeLinkLogger.i(TAG, "process server we-agent delete, partnerAccount=" + partnerAccount);
            handleDeletedWeAgent(partnerAccount, weCrew, source, completion);
            return;
        }
        completion.onSuccess(null);
    }

    /**
     * 使用通知中的名称、头像和描述更新已存在的助理缓存。
     *
     * <p>三个基础字段必须齐全；描述同时兼容 {@code description} 和 {@code desc}。
     * 缓存层负责只更新命中的记录，不创建新的详情缓存。</p>
     */
    public static void updateCachedBasicFieldsIfPresent(
            @NonNull WeAgentStorage storage,
            @NonNull String partnerAccount,
            @NonNull Map<String, Object> data
    ) {
        String name = SdkStringUtils.normalizeOptionalString(TypeConvertUtils.valueAsString(data.get("name")));
        String icon = SdkStringUtils.normalizeOptionalString(TypeConvertUtils.valueAsString(data.get("icon")));
        String description = SdkStringUtils.normalizeOptionalString(
                TypeConvertUtils.valueAsString(data.get("description"))
        );
        if (description == null) {
            description = SdkStringUtils.normalizeOptionalString(TypeConvertUtils.valueAsString(data.get("desc")));
        }
        if (name == null || icon == null || description == null) {
            return;
        }
        storage.updateCachedWeAgentDetails(partnerAccount, name, icon, description);
    }

    @NonNull
    public static Map<String, Object> buildWeAgentData(@NonNull String partnerAccount) {
        Map<String, Object> data = new HashMap<>();
        data.put("partnerAccount", partnerAccount);
        return data;
    }

    @NonNull
    /**
     * 构造三端统一的助理广播结构：事件类型、业务数据和来源扩展信息。
     */
    public static Map<String, Object> buildWeAgentPayload(
            @NonNull String type,
            @NonNull Map<String, Object> data,
            @NonNull String source
    ) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("data", data);
        Map<String, Object> extraData = new HashMap<>();
        extraData.put("source", source);
        payload.put("extraData", extraData);
        return payload;
    }

    /**
     * 按方案规则发送助理事件。
     *
     * <p>更新事件必须先根据 partnerAccount 补拉完整详情，并以完整详情替换原始 data 后广播；
     * 账号缺失、详情为空或请求失败均不广播。删除事件无需网络请求，直接交给宿主广播适配层。</p>
     */
    public void broadcastWeAgentEvent(
            @NonNull String eventName,
            @NonNull Map<String, Object> payload,
            @NonNull SkillCallback<Void> completion
    ) {
        Object type = payload.get("type");
        if ("update".equals(type)) {
            Map<String, Object> data = TypeConvertUtils.valueAsMap(gson, payload.get("data"));
            String partnerAccount = data == null ? null
                    : SdkStringUtils.normalizeOptionalString(TypeConvertUtils.valueAsString(data.get("partnerAccount")));
            if (partnerAccount == null) {
                WeLinkLogger.e(TAG, "skip we-agent update broadcast: partnerAccount is missing");
                completion.onSuccess(null);
                return;
            }
            apiClient.getWeAgentDetails(partnerAccount, new SkillCallback<WeAgentDetailsArrayResult>() {
                @Override
                public void onSuccess(@Nullable WeAgentDetailsArrayResult result) {
                    WeAgentDetailsArrayResult resolved = resolveWeAgentDetailsResult(result);
                    if (resolved.getWeAgentDetailsArray().isEmpty()) {
                        WeLinkLogger.e(TAG, "skip we-agent update broadcast: detail response is empty, partnerAccount="
                                + partnerAccount);
                        completion.onSuccess(null);
                        return;
                    }
                    WeAgentDetails detail = resolved.getWeAgentDetailsArray().get(0);
                    Map<String, Object> finalPayload = new HashMap<>(payload);
                    finalPayload.put("data", gson.fromJson(gson.toJson(detail), new TypeToken<Map<String, Object>>() {
                    }.getType()));
                    dispatchHostBroadcast(eventName, finalPayload);
                    WeLinkLogger.i(TAG, "we-agent update broadcast completed, partnerAccount=" + partnerAccount);
                    completion.onSuccess(null);
                }

                @Override
                public void onError(@NonNull Throwable error) {
                    // Per plan: update broadcast detail fetch failures do not emit a broadcast.
                    WeLinkLogger.e(TAG, "fetch detail before update broadcast failed, partnerAccount="
                            + partnerAccount + ", error=" + error.getMessage());
                    completion.onSuccess(null);
                }
            });
            return;
        }
        dispatchHostBroadcast(eventName, payload);
        WeLinkLogger.i(TAG, "we-agent delete broadcast completed");
        completion.onSuccess(null);
    }

    /**
     * 调用宿主广播能力的统一出口。
     *
     * <p>当前仅保留适配点，后续接入 WeBroadCast 时应在此处透传事件名和完整载荷。</p>
     */
    private void dispatchHostBroadcast(@NonNull String eventName, @NonNull Map<String, Object> payload) {
        // TODO: call host WeBroadCast(eventName, payload) when the host broadcast adapter is wired.
    }

    @NonNull
    public static WeAgentDetailsArrayResult wrapWeAgentDetail(@NonNull WeAgentDetails detail) {
        WeAgentDetailsArrayResult result = new WeAgentDetailsArrayResult();
        List<WeAgentDetails> details = new ArrayList<>();
        details.add(detail);
        result.setWeAgentDetailsArray(details);
        return result;
    }

    /**
     * 创建删除请求上下文，统一保存服务端删除接口所需的 partnerAccount。
     */
    @NonNull
    public DeleteWeAgentContext buildDeleteWeAgentContext(@NonNull String partnerAccount) {
        return new DeleteWeAgentContext(partnerAccount);
    }

    /**
     * 使用上下文中的 partnerAccount 调用服务端删除接口，并原样转发异步结果。
     */
    public void requestDeleteWeAgent(
            @NonNull DeleteWeAgentContext context,
            @NonNull SkillCallback<DeleteWeAgentResult> callback
    ) {
        apiClient.deleteWeAgent(context.partnerAccount, callback);
    }

    /**
     * 处理本端删除助理成功后的缓存、跳转和广播。
     *
     * <p>所有删除都会先移除列表与详情缓存；非当前助理随后直接广播并回调成功。删除当前助理
     * 时还会清空当前详情并调用 buildWeAgentUriResult 计算后续页面，成功后再发送删除广播。</p>
     */
    public void handleDeleteWeAgentResult(
            @NonNull DeleteWeAgentContext context,
            @Nullable DeleteWeAgentResult result,
            @NonNull SkillCallback<DeleteWeAgentResult> callback,
            @NonNull SkillCallback<Void> completion
    ) {
        handleDeletedWeAgent(
                context.partnerAccount,
                buildWeAgentData(context.partnerAccount),
                "local",
                new SkillCallback<Void>() {
                    @Override
                    public void onSuccess(@Nullable Void ignored) {
                        try {
                            callback.onSuccess(result);
                        } finally {
                            completion.onSuccess(null);
                        }
                    }

                    @Override
                    public void onError(@NonNull Throwable error) {
                        try {
                            callback.onError(error);
                        } finally {
                            completion.onError(error);
                        }
                    }
                }
        );
    }

    /**
     * 统一处理冷启动补偿、服务端通知和本端接口触发的助理删除。
     *
     * <p>方法先判断目标是否为当前助理，再幂等清理列表和详情缓存。删除当前助理时还会清空
     * 当前详情并调用 getWeAgentUri 计算后续页面；无论 URI 计算成功或失败，三种来源最终
     * 都使用传入数据和来源发送相同结构的删除广播。</p>
     */
    private void handleDeletedWeAgent(
            @NonNull String partnerAccount,
            @NonNull Map<String, Object> data,
            @NonNull String source,
            @NonNull SkillCallback<Void> callback
    ) {
        boolean deletingCurrentWeAgent = isCurrentWeAgent(partnerAccount);
        WeLinkLogger.i(TAG, "handle we-agent delete mutation, partnerAccount=" + partnerAccount
                + ", source=" + source + ", deletingCurrent=" + deletingCurrentWeAgent);
        weAgentStorage.removeWeAgentFromList(partnerAccount);
        weAgentStorage.removeWeAgentDetails(partnerAccount);
        if (!deletingCurrentWeAgent) {
            broadcastWeAgentEvent(WE_AGENT_EVENT_NAME, buildWeAgentPayload("delete", data, source), callback);
            return;
        }
        weAgentStorage.saveCurrentWeAgentDetail(null);
        buildWeAgentUriResult(weAgentStorage.getCurrentWeAgentDetail(), new SkillCallback<WeAgentUriResult>() {
            @Override
            public void onSuccess(@Nullable WeAgentUriResult nextUris) {
                WeLinkLogger.i(TAG, "resolved URI after deleting current we-agent, partnerAccount=" + partnerAccount);
                // TODO: call openWeAgentCUI with nextUris.weAgentUri, nextUris.assistantDetailUri and nextUris.switchAssistantUri.
                broadcastWeAgentEvent(WE_AGENT_EVENT_NAME, buildWeAgentPayload("delete", data, source), callback);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                WeLinkLogger.e(TAG, "resolve URI after deleting current we-agent failed, partnerAccount="
                        + partnerAccount + ", error=" + error.getMessage());
                broadcastWeAgentEvent(WE_AGENT_EVENT_NAME, buildWeAgentPayload("delete", data, source), callback);
            }
        });
    }

    /**
     * 判断指定 partnerAccount 是否与当前助理详情中的账号一致。
     */
    private boolean isCurrentWeAgent(@NonNull String partnerAccount) {
        return matchesWeAgentDetails(weAgentStorage.getCurrentWeAgentDetail(), partnerAccount);
    }

    public static boolean matchesWeAgentDetails(@Nullable WeAgentDetails details, @NonNull String partnerAccount) {
        if (details == null) {
            return false;
        }
        return partnerAccount.equals(SdkStringUtils.normalizeOptionalString(details.getPartnerAccount()));
    }

    public void buildWeAgentUriResult(
            @Nullable WeAgentDetails details,
            @NonNull SkillCallback<WeAgentUriResult> callback
    ) {
        if (details != null) {
            if (SdkStringUtils.normalizeOptionalString(details.getWeCodeUrl()) == null) {
                callback.onSuccess(WeAgentUriBunilder.buildActivateAssistantFallbackUriResult());
                return;
            }
            callback.onSuccess(WeAgentUriBunilder.isMyAgentDetail(details)
                    ? WeAgentUriBunilder.buildMyAgentWeAgentUriResult(details)
                    : WeAgentUriBunilder.buildLegacyWeAgentUriResult(details));
            return;
        }

        resolveMyWeAgentDetail(new SkillCallback<WeAgentDetails>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetails myAgentDetail) {
                if (myAgentDetail == null) {
                    callback.onSuccess(WeAgentUriBunilder.buildActivateAssistantFallbackUriResult());
                    return;
                }
                if (SdkStringUtils.normalizeOptionalString(myAgentDetail.getWeCodeUrl()) == null) {
                    callback.onSuccess(WeAgentUriBunilder.buildActivateAssistantFallbackUriResult());
                    return;
                }
                callback.onSuccess(WeAgentUriBunilder.buildMyAgentWeAgentUriResult(myAgentDetail));
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onSuccess(WeAgentUriBunilder.buildActivateAssistantFallbackUriResult());
            }
        });
    }

    private void resolveMyWeAgentDetail(@NonNull SkillCallback<WeAgentDetails> callback) {
        apiClient.getMyWeAgentDetail(new SkillCallback<WeAgentDetails>() {
            @Override
            public void onSuccess(@Nullable WeAgentDetails detail) {
                if (detail != null) {
                    cacheMyWeAgentDetail(detail);
                }
                callback.onSuccess(detail);
            }

            @Override
            public void onError(@NonNull Throwable error) {
                callback.onError(error);
            }
        });
    }

    private void cacheMyWeAgentDetail(@NonNull WeAgentDetails detail) {
        WeAgentDetails currentDetail = weAgentStorage.getCurrentWeAgentDetail();
        if (currentDetail == null || WeAgentUriBunilder.isMyAgentDetail(currentDetail)) {
            weAgentStorage.saveCurrentWeAgentDetail(detail);
        }
    }

    /**
     * 将缓存变更任务加入 FIFO 队列；当前任务完成缓存、网络和广播后才启动下一任务。
     */
    public static void enqueueWeAgentCacheMutation(@NonNull WeAgentCacheMutation mutation) {
        boolean shouldStart;
        synchronized (WE_AGENT_CACHE_MUTATION_QUEUE) {
            WE_AGENT_CACHE_MUTATION_QUEUE.offer(mutation);
            WeLinkLogger.i(TAG, "we-agent cache mutation enqueued, queueSize=" + WE_AGENT_CACHE_MUTATION_QUEUE.size());
            shouldStart = !processingWeAgentCacheMutation;
            if (shouldStart) {
                processingWeAgentCacheMutation = true;
            }
        }
        if (shouldStart) {
            processNextWeAgentCacheMutation();
        }
    }

    private static void processNextWeAgentCacheMutation() {
        WeAgentCacheMutation mutation;
        int generation;
        synchronized (WE_AGENT_CACHE_MUTATION_QUEUE) {
            mutation = WE_AGENT_CACHE_MUTATION_QUEUE.peek();
            if (mutation == null) {
                processingWeAgentCacheMutation = false;
                return;
            }
            generation = weAgentCacheMutationGeneration;
            WeLinkLogger.i(TAG, "we-agent cache mutation started, queueSize=" + WE_AGENT_CACHE_MUTATION_QUEUE.size());
        }
        AtomicBoolean finished = new AtomicBoolean(false);
        try {
            mutation.execute(new SkillCallback<Void>() {
                @Override
                public void onSuccess(@Nullable Void ignored) {
                    if (finished.compareAndSet(false, true)) {
                        finishWeAgentCacheMutation(generation);
                    }
                }

                @Override
                public void onError(@NonNull Throwable error) {
                    if (finished.compareAndSet(false, true)) {
                        finishWeAgentCacheMutation(generation);
                    }
                }
            });
        } catch (Throwable ignored) {
            WeLinkLogger.e(TAG, "we-agent cache mutation threw unexpectedly, error=" + ignored.getMessage());
            if (finished.compareAndSet(false, true)) {
                finishWeAgentCacheMutation(generation);
            }
        }
    }

    private static void finishWeAgentCacheMutation(int generation) {
        synchronized (WE_AGENT_CACHE_MUTATION_QUEUE) {
            if (generation != weAgentCacheMutationGeneration) {
                return;
            }
            WE_AGENT_CACHE_MUTATION_QUEUE.poll();
            WeLinkLogger.i(TAG, "we-agent cache mutation completed, remaining=" + WE_AGENT_CACHE_MUTATION_QUEUE.size());
        }
        processNextWeAgentCacheMutation();
    }

    public static void shutdown() {
        synchronized (WE_AGENT_CACHE_MUTATION_QUEUE) {
            WE_AGENT_CACHE_MUTATION_QUEUE.clear();
            processingWeAgentCacheMutation = false;
            weAgentCacheMutationGeneration++;
        }
    }

    public interface WeAgentCacheMutation {
        void execute(@NonNull SkillCallback<Void> completion);
    }

    public static final class DeleteWeAgentContext {
        @NonNull
        private final String partnerAccount;

        private DeleteWeAgentContext(@NonNull String partnerAccount) {
            this.partnerAccount = partnerAccount;
        }
    }

}
