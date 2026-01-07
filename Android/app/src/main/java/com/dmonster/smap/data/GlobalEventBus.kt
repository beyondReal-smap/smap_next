package com.dmonster.smap.data

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Global event bus for cross-ViewModel/Screen communication.
 * Similar to NotificationCenter in iOS.
 */
object GlobalEventBus {
    private val _events = MutableSharedFlow<GlobalEvent>(extraBufferCapacity = 1)
    val events = _events.asSharedFlow()

    suspend fun emit(event: GlobalEvent) {
        _events.emit(event)
    }

    fun tryEmit(event: GlobalEvent) {
        _events.tryEmit(event)
    }
}

sealed class GlobalEvent {
    data object GroupsChanged : GlobalEvent()
    data object ScheduleChanged : GlobalEvent()
}
