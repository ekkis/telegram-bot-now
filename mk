#!/bin/bash

#
#	Synopsis
#	   This is a small collection of tools to help manage and
#      test `now` deployments
#	Author
#      Erick Calder <e@arix.com>
#	Notes
#      For information on usage please refer to the Medium article:
#      https://medium.com/@ekkis/building-a-telegram-bot-in-node-js-now-6daea82ca425
#

help() {
	cat <<- "EOF"
	mk [-d] [command]

	where <command> may be:

		logs - shows deployment logs for your project
		msg [-] <command> <chat_id> <from> - sends a message to your server
		bind - binds your server to the Telegram bot using web hooks
		bind info - shows binding information
		bind rm - removes the existing binding
		clearqueue - useful to wipe out messages stuck in the queue
		secret <key> <value> - installs a secret (appends to the .env)
		secrets - install all secrets in your .env file
		scaffold - creates a skeleton bot in your project directory
		kill - kills running local servers

	To see the actual statements issued by this script when running
	a command prefix the command with -d:

	   $ mk -d bind

	To build a deployment just run this script without arguments:

	   $ mk

	For your first deployment, supply the bot key:

		$mk --bot-key 743460589:AAFNkaZ0X3_51dZTuctsK0RrM9fKCRS22Ds

	-- messaging --

	For development you can run your bot using `npm start`.  You can send
	messages to it from the command line as shown below.  If you want the bot
	to actually send messages to a Telegram chat, set the TELEGRAM_BOT_CHATID
	with a valid value in your environment.  You can also optionally set the
	TELEGRAM_BOT_USERNAME variable if you want to send a specific username in
	the messages.

	To ping the local server:

		$ mk msg -l "/ping"		# local
	
	After deployment (hosted on Now) you can message the bot with `-b`:
	
		$ mk msg -b "/ping"		# deployed

	You can also message Telegram directly.  Hers's how:

		$ mk msg -t "/ping"		# Telegram

	and for sending test messages with images to the bot, supply a valid file id 
	to the -p parameter:

		$ mk msg -b "/ping" -p "AgADAQADaqgxGyX5yETF2DyyOFrdN_9sDDAABO6I-45utcxCSBoEAAEC"

	Contact info can also be sent like this:

		$ mk msg -t "#" -c "+1 (800) 555-1212"

	-- environment --

	To be compatible with the VSCode debugger, environment files cannot include the EXPORT
	statement, without which subshells cannot see the values.  The command below thus allows
	you to initialise your environment from one of these files:

		$ eval `mk env`

	You can also create all the secrets needed for your deployment from the environment
	file by running the following command:

		$ mk secrets

	The script will also indicate any secrets required by your deployment that are missing
	from your environment file

	-- examples --

	To show current bindings:

		$ mk bind info

	To set a secret with credentials for your database:

	   $ mk secret "DATABASE_AUTH" "JohnDoe:SomePassword"

	You can then check that the secret was also added to the environment file:

		$ cat .env
	EOF
	exit 0
}

msg() {
	[ -z "$TELEGRAM_BOT_CHATID" ] && {
		warn="WARNING: Environment variable TELEGRAM_BOT_CHATID not set!"
		warn="$warn  No messages will be sent to Telegram"
		echo -e "\033[33m$warn\033[0m"
	}
	srv=$1; cmd=$2; type=$3; args=$4
	chat_id=$TELEGRAM_BOT_CHATID
	bot_nm=$TELEGRAM_BOT_USERNAME

	d=$(msg_data $srv "$cmd" "$chat_id" "$bot_nm" "$type" "$args")
	method="?bot=$TELEGRAM_BOT_KEY"
	if [ "$srv" == "-t" ]; then
		case $type in
		"-p") method="sendPhoto" ;;
		"-d") method="sendDocument" ;;
		*) method="sendMessage" ;;
		esac
	fi
	fetch $method $srv -d "'$d'" $(hdr -j)
}

bind() {
	[ "$1" == "rm" ] && {
		fetch "/deleteWebhook" -t; return
	}
	[ "$1" == "info" ] && {
		fetch "/getWebhookInfo" -t; return
	}
	#d='{"url": "%s", "allowed_updates": ["message", "channel_post"]}'
	d=$(printf '{"url": "%s"}' "$(cat .url)/server.js?bot=$TELEGRAM_BOT_KEY")
	fetch "/setWebhook" -t -d "'$d'" $(hdr -j)
}

clearqueue() {
	bind rm
	id=$(fetch "/getUpdates" -t 2>/dev/null |jq .result[-1].update_id)
	id=$(echo "$id+1" |bc)
	fetch "/getUpdates" -t "-F 'offset=$id'"
	bind
}

secret() {
	key=$1; val=$2
	now secret add "$key" "$val"
	[ $? -eq 0 ] && {
		key=$(echo $key| sed 's/-/_/g' |awk '{print toupper($0)}')
		echo "$key=$val" >> .env
	}
}

secrets() {
	script=$(cat <<- EOF
	const fs = require('fs')
	const jsp = require('js-prototype-lib')
	jsp.install('string', 'object')
	const now = require('./now.json').env;
	const env = fs.readFileSync('./.env', 'utf8')
		.replace(/^export\s+/gm, '')
		.keyval()
	var val = env.map((self, k, acc) => {
		if (now[k] && env[k]) {
			acc[now[k].replace(/^@/, '')] = env[k].q('')
		}   
	})

	var rm = val.keys().map(k => 'echo Y | now secret rm ' + k)
		.join('\n')
	var add = val.keyval(' ') 
		.replace(/^/gm, 'now secret add ')
	var missing = now.notIn(env);

	console.log(rm)
	console.log(add)
	console.log("echo -e '\n* Environment set up (" + val.keys().length + " keys installed)'")
	if (missing.length > 0) {
		console.log("echo '\nThe following keys are missing from your environment'")
		console.log("echo 'file for your deployment to work:'")
		console.log("echo '\n  * " + missing.join('\n  * ') + "\n'")
	}
	EOF
	)
	script=$(node -e "$script")
	[ -z "$NOEXEC" ] && eval "$script" || echo "$script"
}

scaffold() {
	d=node_modules/telegram-bot-now/scaffold
	cp -r $d/* . > /dev/null

	echo "The following files have been created in your project root:"
	echo " - server.js"
	echo " - now.json"
}

env() {
	cat .env |grep -ve '^\s*$' |sed 's/^/export /' |sed 's/$/;/'
}

logs() {
	msg="Cannot show logs.  No deployment has been made"
	[ ! -f .url ] && {
		echo $msg; exit 0
	}
	url=$(cat .url)
	[ -z "$url" ] && {
		echo $msg; exit 0
	}
	now logs -n ${1:-200} -f $url
}

kill() {
	/bin/kill -9 $(ps aux |grep "[m]icro" |awk '{print $2}')
}

# --- support functionatlity --------------------------------------------------

fetch() {
	srv=$1; cmd=""; shift
	# server is optional
	[[ "$srv" != -* ]] && {
		cmd=$srv; srv=$1; shift
	}
	url="curl --silent $@ $(url $srv)"
	[ ! -z "$cmd" ] && url="$url$cmd"
	[ ! -z "$DEBUG" ] && echo $url > /dev/stderr
	[ -z "$NOEXEC" ] && {
		eval $url
		echo ""
	}
}

url() {
	[ "$1" == "-b" ] && {
		echo "$(cat .url)/server.js"
	}
	[ "$1" == "-l" ] && {
		echo "http://localhost:3000/server.js"
	}
	[ "$1" == "-t" ] && {
		echo "https://api.telegram.org/bot${TELEGRAM_BOT_KEY}"
	}
}

hdr() {
	[[ "$1" == "-j" ]] && {
		echo -H "Content-Type:application/json"
	}
}

msg_data() {
	srv=$1; cmd=$2; chat_id=${3:-0}; from=${4:-testuser}; type=$5; args=$6
	
	if [ "$type" == "-p" ];	then
		if [ "$srv" == "-t" ]; then
			printf "$(msg_photoToTel)" $chat_id $args
		else
			printf "$(msg_photoToBot)" $chat_id $from $args
		fi
	elif [ "$type" == "-k" ]; then
		printf "$(msg_keyboardToTel)" $chat_id "$args"
	elif [ "$type" == "-c" ]; then
		printf "$(msg_contactToBot)" $chat_id $from "$args"
	elif [ "$type" == "-d" ]; then
		printf "$(msg_documentToBot)" $chat_id $from "$args"
	else
		f=$([ "$srv" == "-t" ] && msg_textToTel || msg_textToBot)
		printf "$f" $chat_id $from "$cmd"
	fi
}

msg_textToTel() {
    cat <<- EOF
	{
		"chat_id": "%s",
		"chat_type": "private",
		"username": "%s",
		"parse_mode": "Markdown",
		"text": "%s"
	}
	EOF
}

msg_textToBot() {
	cat <<- EOF
	{ "message": {
		"chat": {"id": "%s", "type": "private"},
		"from": {"username": "%s"},
		"text": "%s"
	}}
	EOF
}

msg_photoToTel() {
	cat <<- EOF 
	{   
		"chat_id": "%s",
		"photo": "%s"
	}   
	EOF
}

msg_photoToBot() {
	cat <<- EOF 
	{ "message": {  
		"chat": {
			"id": "%s",
			"type": "private"
		},
		"from": {"username": "%s"},
		"photo": [{
			"file_id": "%s",
			"file_size": "857",
			"width": "90", 
			"height": "15"
		}]
	}}
	EOF
}

msg_keyboardToTel() {
	cat <<- EOF
	{
		"chat_id": "%s",
		"text": "xx",
		"reply_markup": {
			"keyboard": [%s],
			"one_time_keyboard": true,
			"resize_keyboard": true,
			"selective": false
		}
	}
	EOF
}

msg_contactToBot() {
	cat <<- EOF 
	{ "message": {  
		"chat": {
			"id": "%s",
			"type": "private"
		},
		"from": {"username": "%s"},
		"contact": {
			"phone_number": "%s",
			"first_name": "testuser",
			"user_id": "0" 
		}
	}}
	EOF
}

msg_documentToBot() {
	cat <<- EOF 
	{ "message": {  
		"chat": {
			"id": "%s",
			"type": "private"
		},
		"from": {"username": "%s"},
		"document": {
			file_name: 'tst.pdf',
			mime_type: 'application/pdf',
			thumb: {
				file_id: 'AAQBABMSLBEwAATNIk5Rfkv4jMNhAAIC',
				file_size: 5895,
				width: 247,
				height: 320
			},
			file_id: 'BQADAQADUwADYWIBRwfwuzfSbsn_Ag',
			file_size: 4191 
		}
	}}
	EOF
}

err() {
	echo "$@" > /dev/stderr
}

die() {
	echo -e $1; exit 1
}

mkenv() {
	[ -z "$TELEGRAM_BOT_KEY" ] && {
		echo -e "\nNo environment file available.  Please supply your Telegram bot key."
		read -p "Enter key: " TELEGRAM_BOT_KEY
	}
	echo "TELEGRAM_BOT_KEY=$TELEGRAM_BOT_KEY" > .env
}

# --- main() ------------------------------------------------------------------

[ "$1" == "--help" ] && {
	help
}
[ "$1" == "-d" ] && {
	shift; NOWDEBUG=--debug; set -x
}
[ ! -f .env ] && mkenv
eval `env`
[ "$1" == "--bot-key" ] && {
	TELEGRAM_BOT_KEY=$2
	shift; shift
}
[[ ! -z "$1" && ! "$1" =~ "-" ]] && {
	type "$1" &>/dev/null || die "Command [$1] not supported!"
	[ ! -z "$DEBUG" ] && echo "CMD=$@"
	"$@"; exit
}

[ -f .url ] && url=$(cat .url)
[ ! -z "$url" ] && now rm --yes $url
now $NOWDEBUG $1 > .url
[ $? == 0 ] && {
	echo -e "\nBinding deployment to Telegram webhook..."
	bind
}