<script lang="ts">

    export let ws: WebSocket;
    export let sessionID: string;
    export let lobbyPlayerCounts: number[];

    const crazyEightsLobbyCount = 5;
    const goFishLobbyCount = 5;
    const texasHoldemLobbyCount = 5;

    const joinLobby = (lobbyNumber: number) => {
        ws.send(JSON.stringify({
            type: 'join_lobby',
            lobbyNumber: lobbyNumber,
            sessionID: sessionID
        }));
    }
</script>

<div class="main">
    <div class="container">
        {#each Array(crazyEightsLobbyCount) as _, i}
            <button
                on:click={() => joinLobby(i+1)}
            >
                <span>Lobby {i+1}</span>
                <span>Crazy Eights</span>
                <span>{lobbyPlayerCounts[i]}/10</span>
            </button>
        {/each}
        {#each Array(goFishLobbyCount) as _, i}
            <button
                on:click={() => joinLobby(i+crazyEightsLobbyCount+1)}
            >
                <span>Lobby {i+crazyEightsLobbyCount+1}</span>
                <span>Go Fish</span>
                <span>{lobbyPlayerCounts[crazyEightsLobbyCount+i]}/10</span>
            </button>
        {/each}
        {#each Array(texasHoldemLobbyCount) as _, i}
            <button
                on:click={() => joinLobby(i+crazyEightsLobbyCount+goFishLobbyCount+1)}
            >
                <span>Lobby {i+crazyEightsLobbyCount+goFishLobbyCount+1}</span>
                <span>Texas Hold'em</span>
                <span>{lobbyPlayerCounts[crazyEightsLobbyCount+goFishLobbyCount+i]}/10</span>
            </button>
        {/each}
    </div>
</div>

<style>
    .main {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }

    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
    }

    button {
        display: flex;
        justify-content: space-between;
        width: 30rem;
        padding: 1rem;
        margin: 1rem;
        font-size: 16pt;
    }
</style>
