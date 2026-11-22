Shader "Custom/StencilMask"
{
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Geometry-1" }
        ColorMask 0
        ZWrite Off

        Pass
        {
            Stencil
            {
                Ref 1
                Comp Always
                Pass Replace
            }
        }
    }
}
