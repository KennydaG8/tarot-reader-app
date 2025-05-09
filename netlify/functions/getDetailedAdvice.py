import json
import os
import anthropic

ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
CLAUDE_MODEL_DETAIL = "claude-3-5-sonnet-latest" # Or "claude-3-opus-20240229"
MAX_TOKENS_DETAIL = 2048

def handler(event, context):
    if not ANTHROPIC_API_KEY:
        return {"statusCode": 500, "body": json.dumps({"error": "API key not configured."})}

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        if event.get("httpMethod") != "POST":
            return {"statusCode": 405, "body": json.dumps({"error": "Method Not Allowed"})}

        body = json.loads(event.get("body", "{}"))
        topic = body.get("topic")
        question = body.get("question")
        drawn_cards = body.get("drawn_cards")
        concise_interpretation = body.get("concise_interpretation")

        if not all([topic, question, drawn_cards, concise_interpretation]) or len(drawn_cards) != 3:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing required fields for detailed advice."})
            }

        detail_system_prompt = "你是一位富有洞察力和同理心的顧問。請基於以下提供的塔羅牌陣資訊和初步解讀，提供一個更深入、更詳盡、更具體的分析和建議。\n請包含：\n1.牌意關聯與故事線。\n2.核心洞見、挑戰或機遇。\n3.具體行動建議或思考方向。\n4.潛在盲點提醒。\n請用豐富、細膩且充滿同理心的語言來表達。"

        user_prompt_for_detail = f"## 原始提問背景\n"
        user_prompt_for_detail += f"* 探尋領域：「{topic}」\n"
        user_prompt_for_detail += f"* 提問：「{question}」\n\n"
        user_prompt_for_detail += f"## 抽出的牌陣\n"
        position_labels = ["往昔之影 (過去/背景)", "當下之核 (現在/核心)", "未來之徑 (未來/結果)"]
        for i, card in enumerate(drawn_cards):
            position = position_labels[i]
            orientation = '逆位' if card.get('isReversed', False) else '正位'
            keywords_list = card.get('keywords', [])
            card_name = card.get('name', '未知卡牌')
            user_prompt_for_detail += f"* **星位 {i + 1}: {position}**\n"
            user_prompt_for_detail += f"    * 牌卡: {card_name} ({orientation})\n"
            user_prompt_for_detail += f"    * 關鍵詞: {', '.join(keywords_list)}\n" # Removed extra \n
        user_prompt_for_detail += f"\n## 初步簡潔解讀\n" # Added newline before
        user_prompt_for_detail += f"```\n{concise_interpretation}\n```\n\n"
        user_prompt_for_detail += f"## 請提供深入分析與建議"

        message = client.messages.create(
            model=CLAUDE_MODEL_DETAIL,
            max_tokens=MAX_TOKENS_DETAIL,
            system=detail_system_prompt,
            messages=[{"role": "user", "content": user_prompt_for_detail}]
        )

        advice = message.content[0].text if message.content else "抱歉，無法生成詳細建議。"
        
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"advice": advice})
        }

    except json.JSONDecodeError:
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid JSON in request body."})}
    except anthropic.APIError as e:
        print(f"Anthropic API Error: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": f"Claude API Error: {str(e)}"})}
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": f"An unexpected server error occurred: {str(e)}"})}