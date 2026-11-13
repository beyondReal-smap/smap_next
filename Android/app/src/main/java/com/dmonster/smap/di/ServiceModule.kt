package com.dmonster.smap.di

import android.content.Context
import android.content.SharedPreferences
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.auth.TokenStore
import com.dmonster.smap.data.billing.BillingManager
import com.dmonster.smap.data.service.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object ServiceModule {

    @Provides @Singleton
    fun provideAuthService(
        api: SmapApi,
        prefs: SharedPreferences,
        tokenStore: TokenStore
    ): AuthService = AuthService(api, prefs, tokenStore)

    // 그룹 목록/멤버 조회처럼 여러 화면이 동시에 부르는 요청을 하나로 합치기 위해 서비스들이 같은 인스턴스를 공유한다.
    @Provides @Singleton
    fun provideRequestCoalescer(): RequestCoalescer = RequestCoalescer()

    @Provides @Singleton
    fun provideGroupService(api: SmapApi, authService: AuthService, coalescer: RequestCoalescer): GroupService =
        GroupService(api, authService, coalescer)

    @Provides @Singleton
    fun provideHomeService(api: SmapApi, authService: AuthService, coalescer: RequestCoalescer): HomeService =
        HomeService(api, authService, coalescer)

    @Provides @Singleton
    fun provideScheduleService(api: SmapApi, authService: AuthService): ScheduleService =
        ScheduleService(api, authService)

    @Provides @Singleton
    fun provideMyPlaceService(api: SmapApi): MyPlaceService = MyPlaceService(api)

    @Provides @Singleton
    fun provideNotificationService(api: SmapApi): NotificationService = NotificationService(api)

    @Provides @Singleton
    fun provideActivityLogService(api: SmapApi): ActivityLogService = ActivityLogService(api)

    @Provides @Singleton
    fun provideChatService(api: SmapApi): ChatService = ChatService(api)

    @Provides @Singleton
    fun provideChatSocketManager(authService: AuthService): ChatSocketManager =
        ChatSocketManager(authService)

    @Provides @Singleton
    fun provideSubscriptionService(
        api: SmapApi,
        prefs: SharedPreferences,
        authService: AuthService
    ): SubscriptionService = SubscriptionService(api, prefs, authService)

    @Provides @Singleton
    fun provideBillingManager(
        @ApplicationContext context: Context,
        subscriptionService: SubscriptionService,
        authService: AuthService
    ): BillingManager = BillingManager(context, subscriptionService, authService)
}
