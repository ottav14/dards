<script lang="ts">
    export let ws: WebSocket;
    export let loginErrorMessage: string;

    let username: string = '';
    let password: string = '';

    const register = () => {
        ws.send(JSON.stringify({
            type: 'register',
            username: username,
            password: password
        }));
    }

    const login = () => {
        ws.send(JSON.stringify({
            type: 'login',
            username: username,
            password: password
        }));
    }

    const guest = () => {
        ws.send(JSON.stringify({
            type: 'guest'
        }));
    }

</script>

<div class="loginContainer">
    <h2>Login</h2>
    <span class="loginErrorMessage">
        {loginErrorMessage}
    </span>
    <label for="username">Username:</label>
    <input 
        type="text" 
        name="username" 
        bind:value={username}
    />
    <label for="password">Password:</label>
    <input 
        type="text" 
        name="password" 
        bind:value={password}
    />
    <button
        on:click={login}
    >
        Login
    </button>
    <button
        on:click={register}
    >
        Register
    </button>
        <button
            on:click={guest}
        >
            Play as guest
        </button>
</div>

<style>
    button {
        margin-top: 1rem;
        padding: 1rem;
    }

    label {
        margin-top: 1rem;
    }

    input {
        margin-bottom: 1rem;
    }

    .loginContainer {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }

    * {
        font-size: 16pt;
    }

    .loginErrorMessage {
        color: red;
    }
</style>
