    import os
    from openai import OpenAI

    # Initialize client with DeepSeek's endpoint
    client = OpenAI(
        api_key="",
        base_url="https://api.deepseek.com"
    )

    # Make a request
    response = client.chat.completions.create(
        model="deepseek-v4-flash",
        messages=[{"role": "user", "content": "Solve this complex algorithm problem..."}],
        reasoning_effort="high",
        extra_body={"thinking": {"type": "enabled"}}
    )
    print("Reasoning:", response.choices[0].message.reasoning_content)
    print("Answer:", response.choices[0].message.content)