<script lang="ts">
    
    export let ws: WebSocket;
    export let uuid: string;
    export let username: string;
    export let lobbyData: any[];

    let ready = false;

    const readyToggle = () => {
        ready = !ready;
        ws.send(JSON.stringify({
            type: 'ready_toggle',
            value: ready,
            uuid: uuid
        }));
    }
</script>

<div class="waitingNotice">
    <div class="players">
        {#each lobbyData as data}
            <div class="playerContainer">
                <span class="playerReady">
                    {data.username}
                </span>
                <div class={`readyBox ${data.ready ? 'toggled' : 'notToggled'}`}>
                    Ready
                </div>
            </div>
        {/each}
    </div>
    <p>
    {lobbyData ? 'Waiting for another player...' : 'Waiting for players to ready up...'}
    </p>
    <button 
        class={`readyButton ${ready ? 'toggled' : 'notToggled'}`}
        on:click={readyToggle}
    >
        Ready
    </button>
        {username}
</div>

<style>
    .playerReady {
        padding: 1rem;
    }

    .playerContainer {
        display: flex;
        flex-direction: column;
        padding: 1rem;
        text-align: center;
    }

    .players {
        display: flex;
    }

    .readyBox {
        padding: 1rem;
    }

    .waitingNotice {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        align-items: center;
        height: 100vh;
        font-size: 16pt;
    }

    .readyButton {
        font-size: 16pt;
        padding: 1rem;
    }

    .notToggled {
        background: red;
    }

    .toggled {
        background: green;
    }
</style>
