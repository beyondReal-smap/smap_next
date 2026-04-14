package com.dmonster.smap.di

import android.content.SharedPreferences
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.auth.TokenStore
import com.dmonster.smap.data.service.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
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

    @Provides @Singleton
    fun provideGroupService(api: SmapApi, authService: AuthService): GroupService =
        GroupService(api, authService)

    @Provides @Singleton
    fun provideHomeService(api: SmapApi, authService: AuthService): HomeService =
        HomeService(api, authService)

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
}
